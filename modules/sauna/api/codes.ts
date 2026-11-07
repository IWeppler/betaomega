import { sameOrigin } from "@/platform/auth/server";
import { getSite } from "@/platform/sites/server";
import { failedAttempts, findCode, listCodes, recordFailedAttempt, saveCode, turnTypeIds, usesOf } from "../data/codes";
import { listTurnTypes } from "../data/setup";
import { checkCode, cleanCode, describeCode, isCodeText, normalizeCode } from "../domain/codes";
import { cleanArgentineWhatsapp, CustomerError } from "../domain/customer";
import { rejectionMessages } from "../domain/rejections";
import { fail, failure, noStore, originHash, panelRead, panelWrite, readJson, type SiteContext } from "./route-tools";

// Discount codes (docs/SAUNA.md §4): their management in the panel and the check of the booking form. What a code is worth is decided again by
// sauna_reserve, under the code's lock: the check only shows it before reserving.

/** Failed attempts allowed per origin and hour, counting the check and the reservation together. Enough for typos, too few to guess. */
const MAX_FAILED_ATTEMPTS = 10;
export const CODE_ATTEMPTS_MESSAGE = "Probaste muchos códigos seguidos. Esperá un rato, o reservá sin código y consultanos por WhatsApp.";

export const tooManyCodeAttempts = async (siteId: string, origin: string) => await failedAttempts(siteId, origin) >= MAX_FAILED_ATTEMPTS;

const UUID = /^[0-9a-f-]{36}$/i;

/** POST { code, roomId, turnTypeId, whatsapp? }: what the code does on that turn, or why it does not apply. The number, if already typed, checks the per-person limit. */
export async function postCodeCheck(request: Request, context: SiteContext) {
  if (!sameOrigin(request)) return fail(403, "Origen no permitido.");
  const site = await getSite((await context.params).site);
  if (site?.kind !== "sauna") return fail(404, "Sitio no encontrado.");
  try {
    const body = await readJson(request, 1_000) as Record<string, unknown> | null;
    const roomId = typeof body?.roomId === "string" && UUID.test(body.roomId) ? body.roomId : null;
    const turnTypeId = typeof body?.turnTypeId === "string" && UUID.test(body.turnTypeId) ? body.turnTypeId : null;
    if (typeof body?.code !== "string" || !body.code.trim() || !roomId || !turnTypeId) return fail(400, "Escribí el código.");
    const text = normalizeCode(body.code.slice(0, 60));
    let whatsapp: string | null = null;
    try { whatsapp = body.whatsapp ? cleanArgentineWhatsapp(body.whatsapp) : null; } catch (error) { if (!(error instanceof CustomerError)) throw error; }

    const origin = originHash(request);
    if (await tooManyCodeAttempts(site.id, origin)) return fail(429, CODE_ATTEMPTS_MESSAGE);
    const code = isCodeText(text) ? await findCode(site.id, text) : null;
    const reason = !code ? "code_not_found" : checkCode(code, { roomId, turnTypeId }, await usesOf(site.id, code.id, whatsapp), new Date().toISOString());
    if (reason || !code) {
      await recordFailedAttempt(site.id, origin);
      return fail(409, rejectionMessages[reason ?? "code_not_found"]);
    }
    return Response.json({ code: code.code, type: code.type, value: code.value, description: describeCode(code) }, { headers: noStore });
  } catch (error) { return failure(error, "revisar el código"); }
}

export const getCodes = panelRead(async (_request, site) => {
  try {
    const [codes, types] = await Promise.all([listCodes(site.id), listTurnTypes(site.id)]);
    return Response.json({ now: new Date().toISOString(), codes, types: types.map(type => ({ id: type.id, name: type.name })) }, { headers: noStore });
  } catch (error) { return failure(error, "leer los códigos"); }
});

/** Creates a code, or saves one over the version that was read. Codes are deactivated, never deleted: past bookings name them. */
export const postCode = panelWrite(async (request, site) => {
  try {
    await saveCode(site.id, cleanCode(await readJson(request, 2_000), await turnTypeIds(site.id)));
    return Response.json({ ok: true });
  } catch (error) { return failure(error, "guardar el código"); }
});
