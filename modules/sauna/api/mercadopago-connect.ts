import { createHash, randomBytes } from "node:crypto";
import { equal, isAdmin } from "@/platform/auth/server";
import { getPanelSite } from "@/platform/sites/server";
import { readAccount, removeAccount, saveAccount, type ConnectedAccount } from "../data/mercadopago-account";
import { accountProfile, exchangeCode, MercadoPagoError, mercadoPagoApp } from "../data/mercadopago";
import { ARGENTINA, authorizationUrl, OAUTH_CALLBACK_PATH, oauthCookieValue, oauthRedirect, readOauthCookie, tokensFrom } from "../domain/mercadopago";
import { fail, failure, panelWrite, type SiteContext } from "./route-tools";

// Connecting the Mercado Pago account a site charges into, from the panel (OAuth with PKCE, docs/SAUNA.md §6).
//
// Mercado Pago only returns to a static address registered in the application, so every site comes back to the same one (OAUTH_CALLBACK_PATH) and the
// site travels in the start's cookie. The panel's session cookie is SameSite=Strict, so it does not come along when Mercado Pago sends the browser back.
// The answer is tied to the start instead: only an administrator can start, and the start leaves a short Lax cookie with the site, a random `state` and
// the PKCE verifier. The return is accepted only with that same state, so nobody can link another account by sending someone a crafted link: that
// account is where the money would go.

const COOKIE = "sauna_mp_oauth";
const COOKIE_SECONDS = 600; // Mercado Pago's code lasts 10 minutes

type Result = "conectado" | "cancelado" | "error" | "dominio" | "pais";

/** The panel's own address, as the browser reached it. */
function panelOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${protocol}://${host}`;
}

const redirectUri = (origin: string) => oauthRedirect(process.env.MERCADOPAGO_REDIRECT_URL?.trim() || undefined, origin);

function cookie(value: string, maxAge: number, secure: boolean) {
  return `${COOKIE}=${value}; Path=${OAUTH_CALLBACK_PATH}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

/** Back to the configuration, on the tab of payments, saying how it went. Without a known site, to the panel's start. */
function backToPanel(origin: string, siteId: string | null, result: Result, secure: boolean) {
  const location = siteId ? `${origin}/${siteId}/ajustes?mercadopago=${result}#cobros` : `${origin}/`;
  return new Response(null, {
    status: 303,
    headers: { Location: location, "Set-Cookie": cookie("", 0, secure), "Cache-Control": "no-store" },
  });
}

/** GET: starts connecting (or replacing) the account. A link, not a form: the browser has to leave for Mercado Pago anyway. */
export async function startMercadoPagoConnect(request: Request, context: SiteContext) {
  if (!await isAdmin()) return fail(401, "Ingresá como administrador.");
  const site = await getPanelSite((await context.params).site);
  if (site?.kind !== "sauna") return fail(404, "Sitio no encontrado.");
  const origin = panelOrigin(request);
  const secure = origin.startsWith("https://");
  const app = mercadoPagoApp();
  if (!app) return backToPanel(origin, site.id, "error", secure);
  // The return has to land on this same host, or the start's cookie does not come with it.
  const returnTo = redirectUri(origin);
  if (!returnTo) {
    console.error("[sauna mercadopago] MERCADOPAGO_REDIRECT_URL is not on the host the panel was opened from");
    return backToPanel(origin, site.id, "dominio", secure);
  }
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const location = authorizationUrl({ clientId: app.clientId, redirectUri: returnTo, state, challenge });
  return new Response(null, {
    status: 303,
    headers: { Location: location, "Set-Cookie": cookie(oauthCookieValue(site.id, state, verifier), COOKIE_SECONDS, secure), "Cache-Control": "no-store" },
  });
}

const cookieOf = (request: Request) =>
  request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);

/** GET: where Mercado Pago sends the browser back, with `code` and `state`, or `error` when the person did not authorize. The same for every site. */
export async function finishMercadoPagoConnect(request: Request) {
  const origin = panelOrigin(request);
  const secure = origin.startsWith("https://");
  const params = new URL(request.url).searchParams;
  const raw = cookieOf(request);
  const started = readOauthCookie(raw);
  if (!started || !equal(started.state, params.get("state") ?? "")) {
    // Which check failed, never the values: whether the start's cookie came, whether it could be read, whether the state matched.
    const names = request.headers.get("cookie")?.split(";").map(part => part.trim().split("=")[0]).join(",") ?? "";
    const reason = raw === undefined ? "no start cookie" : !started ? "start cookie unreadable" : !params.get("state") ? "no state in the return" : "state differs";
    console.error(`[sauna mercadopago] oauth return without a matching start: ${reason}; cookies: [${names.slice(0, 200)}]; mercado pago error: ${params.get("error") ?? "none"}`);
    return backToPanel(origin, started?.siteId ?? null, "error", secure);
  }
  const site = await getPanelSite(started.siteId);
  if (site?.kind !== "sauna") return backToPanel(origin, null, "error", secure);
  const code = params.get("code");
  if (!code || params.get("error")) return backToPanel(origin, site.id, "cancelado", secure);
  const app = mercadoPagoApp();
  const returnTo = redirectUri(origin);
  if (!app || !returnTo || !/^[A-Za-z0-9_-]{1,300}$/.test(code)) return backToPanel(origin, site.id, "error", secure);
  try {
    const tokens = tokensFrom(await exchangeCode(app, code, returnTo, started.verifier), new Date().toISOString());
    if (!tokens) throw new MercadoPagoError("token answer incomplete");
    const profile = await accountProfile(tokens.accessToken);
    // Another country's account would take the checkout in its own currency, and those payments are never applied: it is not saved.
    if (profile.siteId !== ARGENTINA) {
      console.error("[sauna mercadopago] account of another country refused:", profile.siteId);
      return backToPanel(origin, site.id, "pais", secure);
    }
    await saveAccount(site.id, tokens, profile.nickname, true);
    return backToPanel(origin, site.id, "conectado", secure);
  } catch (error) {
    console.error("[sauna mercadopago] oauth failed:", error instanceof Error ? error.message.slice(0, 200) : "error");
    return backToPanel(origin, site.id, "error", secure);
  }
}

/** DELETE: the site stops charging with Mercado Pago. Payments already made stay in that account and in the ledger. */
export const disconnectMercadoPago = panelWrite(async (_request, site) => {
  try {
    await removeAccount(site.id);
    return new Response(null, { status: 204 });
  } catch (error) { return failure(error, "desconectar Mercado Pago"); }
});

export type MercadoPagoStatus = { configured: boolean; account: ConnectedAccount | null };

/** What the configuration shows: whether the application is set up on the server, and which account is connected. */
export async function mercadoPagoStatus(siteId: string): Promise<MercadoPagoStatus> {
  return { configured: mercadoPagoApp() !== null, account: await readAccount(siteId) };
}
