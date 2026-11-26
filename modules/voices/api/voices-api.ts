import { isAdmin, sameOrigin } from "@/platform/auth/server";
import { notify } from "@/platform/notifications/server";
import { listPublishedProducts } from "@/platform/products/server";
import { getPanelSite, getSite } from "@/platform/sites/server";
import { cleanComment, isCommentStatus, maxCommentsPerHour, sentTooFast } from "../domain/comments";
import { cleanMetric, looksLikeBot, reportRanges } from "../domain/metrics";
import { addComment, deleteComment, hashAddress, listComments, recentBodies, setCommentStatus } from "../data/comments";
import { metricsReport, track } from "../data/metrics";

// Route logic of the voices sites (docs/PATTERNS.md, pattern 8): readers' comments, their moderation in the panel, and the own metrics.
// Only product sites with the news home page have them.

type SiteContext = { params: Promise<{ site: string; id?: string }> };
const noStore = { "Cache-Control": "no-store" };
const answer = (status: number, body: unknown) => Response.json(body, { status, headers: noStore });
const fail = (status: number, error: string) => answer(status, { error });
const ignored = () => new Response(null, { status: 204 });
const isVoicesSite = (site: Awaited<ReturnType<typeof getSite>>) => site?.kind === "productos" && site.products?.landing === "news" ? site : undefined;
const publicSite = async (context: SiteContext) => isVoicesSite(await getSite((await context.params).site));
const panelSite = async (context: SiteContext) => isVoicesSite(await getPanelSite((await context.params).site));

/** Validation goes to the person as it is; Supabase failures are logged and summed up. */
function failure(error: unknown, action: string) {
  if (error instanceof SyntaxError) return fail(400, "Datos inválidos.");
  if (error instanceof Error && !("code" in error)) return fail(400, error.message);
  console.error(`[voices] ${action} failed:`, error);
  return fail(500, `No se pudo ${action}. Probá de nuevo en unos minutos.`);
}

const thanks = () => answer(201, { ok: true, message: "¡Gracias! Tu comentario se va a ver cuando lo revisemos." });

/** A reader leaves a comment on a published voice. It is stored as pending: nothing shows until the panel approves it. */
export async function postComment(request: Request, context: SiteContext) {
  if (!sameOrigin(request)) return fail(403, "Origen no permitido.");
  const site = await publicSite(context);
  if (!site) return fail(404, "Sitio no encontrado.");
  try {
    const text = await request.text();
    if (text.length > 6000) return fail(413, "El comentario es demasiado largo.");
    const data: unknown = JSON.parse(text);
    const extra = data && typeof data === "object" ? data as Record<string, unknown> : {};
    // The honeypot is a field people never see: a filled one is a script. It gets the same answer as a real comment, so it learns nothing.
    if (typeof extra.website === "string" && extra.website.trim()) return thanks();
    if (sentTooFast(extra.startedAt)) return fail(429, "Esperá un instante antes de enviar el comentario.");
    const comment = cleanComment(data);
    const voice = (await listPublishedProducts(site)).find(product => product.id === comment.voiceId);
    if (!voice) return fail(404, "Esa voz sagrada ya no está publicada.");
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ipHash = hashAddress(forwarded || request.headers.get("x-real-ip") || "local");
    const recent = await recentBodies(site.id, ipHash);
    // The same text twice in an hour is a double click: answered as saved, stored once.
    if (recent.includes(comment.body)) return thanks();
    if (recent.length >= maxCommentsPerHour) return fail(429, "Ya enviaste varios comentarios. Probá de nuevo en un rato.");
    await addComment(site.id, comment, ipHash);
    notify({ siteId: site.id, event: "voces.comment_new", voiceName: voice.name });
    return thanks();
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      console.error("[voices] comment save failed:", error);
      return fail(500, "No pudimos guardar tu comentario. Probá de nuevo en unos minutos.");
    }
    return failure(error, "guardar el comentario");
  }
}

/** The panel's list of comments, with the voices' names (a deleted voice has none). */
export async function getComments(_request: Request, context: SiteContext) {
  if (!await isAdmin()) return fail(401, "Ingresá como administrador.");
  const site = await panelSite(context);
  if (!site) return fail(404, "Este sitio no tiene comentarios.");
  try {
    const [comments, voices] = await Promise.all([listComments(site.id), listPublishedProducts(site)]);
    return answer(200, { comments, voices: voices.map(({ id, name, slug }) => ({ id, name, slug })) });
  } catch (error) { return failure(error, "leer los comentarios"); }
}

/** PATCH { status }: approve, hide or send back to pending. */
export async function patchComment(request: Request, context: SiteContext) {
  if (!sameOrigin(request) || !await isAdmin()) return fail(403, "Ingresá como administrador para moderar.");
  const site = await panelSite(context);
  const id = (await context.params).id ?? "";
  if (!site || !/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "Comentario no encontrado.");
  try {
    const { status } = JSON.parse(await request.text()) as { status?: unknown };
    if (!isCommentStatus(status)) return fail(400, "Estado inválido.");
    const updated = await setCommentStatus(site.id, id, status);
    return updated ? answer(200, updated) : fail(404, "Comentario no encontrado.");
  } catch (error) { return failure(error, "cambiar el comentario"); }
}

export async function removeComment(request: Request, context: SiteContext) {
  if (!sameOrigin(request) || !await isAdmin()) return fail(403, "Ingresá como administrador para eliminar.");
  const site = await panelSite(context);
  const id = (await context.params).id ?? "";
  if (!site || !/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "Comentario no encontrado.");
  try {
    await deleteComment(site.id, id);
    return new Response(null, { status: 204 });
  } catch (error) { return failure(error, "eliminar el comentario"); }
}

/** Beacons may arrive without an Origin header; when there is one it must be this site's. */
function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.get("host"); } catch { return false; }
}

/**
 * The public site reports a visit or a search. Crawlers, link previews and the administrator's own visits are ignored (answered as done, so
 * nothing tells them apart). Nothing here can fail the page: the browser does not wait for the answer.
 */
export async function postMetric(request: Request, context: SiteContext) {
  if (!originAllowed(request)) return fail(403, "Origen no permitido.");
  if (looksLikeBot(request.headers.get("user-agent")) || /prefetch|preview/i.test(request.headers.get("purpose") ?? request.headers.get("sec-purpose") ?? "")) return ignored();
  const site = await publicSite(context);
  if (!site) return fail(404, "Sitio no encontrado.");
  try {
    const text = await request.text();
    if (text.length > 1000) return fail(413, "Evento inválido.");
    const event = cleanMetric(JSON.parse(text));
    if (await isAdmin()) return ignored();
    if (event.kind === "search") { await track(site.id, "search", "", event.term); return ignored(); }
    // A voice that is not published has no views to count.
    if (event.voiceId && !(await listPublishedProducts(site)).some(product => product.id === event.voiceId)) return ignored();
    await Promise.all([track(site.id, "page_view"), event.voiceId ? track(site.id, "voice_view", event.voiceId) : undefined]);
    return ignored();
  } catch (error) {
    if (error instanceof SyntaxError) return fail(400, "Evento inválido.");
    if (error instanceof Error && !("code" in error)) return fail(400, error.message);
    console.error("[voices] metric failed:", error);
    return ignored();
  }
}

/** The panel's report for the last 7, 30 or 90 days, with the voices' names. */
export async function getMetrics(request: Request, context: SiteContext) {
  if (!await isAdmin()) return fail(401, "Ingresá como administrador.");
  const site = await panelSite(context);
  if (!site) return fail(404, "Este sitio no tiene métricas.");
  const asked = Number(new URL(request.url).searchParams.get("days"));
  const days = (reportRanges as readonly number[]).includes(asked) ? asked : 30;
  try {
    const [report, voices] = await Promise.all([metricsReport(site.id, days), listPublishedProducts(site)]);
    return answer(200, { report, voices: voices.map(({ id, name, slug }) => ({ id, name, slug })) });
  } catch (error) { return failure(error, "leer las métricas"); }
}
