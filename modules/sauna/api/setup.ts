import { addClosure, listBands, listClosures, listRooms, listTurnTypes, readSettings, removeClosure, saveSettings, saveTurnType, saveWeek } from "../data/setup";
import { readPage, savePage } from "../data/page";
import { cleanTurnType, cleanWeek } from "../domain/hours";
import { cleanPage } from "../domain/page";
import { cleanSettings, closureFromDays, closureFromRange } from "../domain/setup";
import { restOfBusinessDay } from "../domain/time";
import { mercadoPagoStatus } from "./mercadopago-connect";
import { fail, failure, homeWrite, noStore, panelRead, panelWrite, readJson } from "./route-tools";

const BODY_LIMIT = 4_000;

export const getConfig = panelRead(async (_request, site) => {
  try {
    const [settings, rooms, types, bands, closures, page, mercadopago] = await Promise.all([readSettings(site.id), listRooms(site.id), listTurnTypes(site.id), listBands(site.id), listClosures(site.id), readPage(site.id), mercadoPagoStatus(site.id)]);
    return Response.json({ settings, rooms, types, bands, closures, page, mercadopago }, { headers: noStore });
  } catch (error) { return failure(error, "leer la configuración"); }
});

export const patchSettings = homeWrite(async (request, site) => {
  try {
    return Response.json(await saveSettings(site.id, cleanSettings(await readJson(request, BODY_LIMIT))));
  } catch (error) { return failure(error, "guardar los ajustes"); }
});

export const putPage = homeWrite(async (request, site) => {
  try {
    await savePage(site.id, cleanPage(await readJson(request, 20_000)));
    return Response.json({ ok: true });
  } catch (error) { return failure(error, "guardar los textos del sitio"); }
});

export const putWeek = homeWrite(async (request, site) => {
  try {
    const body = await readJson(request, 12_000);
    await saveWeek(site.id, cleanWeek(body, await listTurnTypes(site.id)));
    return Response.json({ ok: true });
  } catch (error) { return failure(error, "guardar los horarios"); }
});

/** Only what changed: a type removed from the list arrives with active: false. */
export const putTypes = homeWrite(async (request, site) => {
  try {
    const body = await readJson(request, BODY_LIMIT) as { types?: unknown } | null;
    if (!Array.isArray(body?.types)) return fail(400, "Datos inválidos.");
    for (const type of body.types.map(cleanTurnType)) await saveTurnType(site.id, type);
    return Response.json({ ok: true });
  } catch (error) { return failure(error, "guardar los tipos de turno"); }
});

/** The server decides today's remainder; other closures use whole business days or explicit instants. */
export const postClosure = panelWrite(async (request, site) => {
  try {
    const body = await readJson(request, BODY_LIMIT);
    const closure = (body as { today?: unknown } | null)?.today === true
      ? { roomId: null, reason: "No se habilitan más turnos por hoy", ...restOfBusinessDay(new Date().toISOString()) }
      : (body as { startsAt?: unknown } | null)?.startsAt !== undefined ? closureFromRange(body) : closureFromDays(body);
    return Response.json(await addClosure(site.id, closure));
  } catch (error) { return failure(error, "guardar el cierre"); }
});

export const deleteClosure = panelWrite(async (request, site) => {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(400, "Cierre inválido.");
  try {
    await removeClosure(site.id, id);
    return new Response(null, { status: 204 });
  } catch (error) { return failure(error, "borrar el cierre"); }
});
