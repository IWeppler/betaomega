import { removeDestination, updateDestination } from "@/platform/notifications/manage";
import { choice, fail, failure, guard, readBody } from "../guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const kindOf = (value: unknown) => (value === "push" || value === "telegram" ? value : null);

/** PATCH { kind, id, label, siteIds }: renames a phone or chat, or changes its sites. */
export async function PATCH(request: Request) {
  const refused = await guard(request, true);
  if (refused) return refused;
  try {
    const body = await readBody(request);
    const kind = kindOf(body.kind);
    if (!kind || typeof body.id !== "string") return fail(400, "Datos inválidos.");
    const { label, siteIds } = await choice(body);
    await updateDestination(kind, body.id, label, siteIds);
    return Response.json({ ok: true });
  } catch (error) { return failure(error, "guardar el destino"); }
}

/** DELETE { kind, id }: that phone or chat stops receiving notices. */
export async function DELETE(request: Request) {
  const refused = await guard(request, true);
  if (refused) return refused;
  try {
    const body = await readBody(request);
    const kind = kindOf(body.kind);
    if (!kind || typeof body.id !== "string") return fail(400, "Datos inválidos.");
    await removeDestination(kind, body.id);
    return Response.json({ ok: true });
  } catch (error) { return failure(error, "quitar el destino"); }
}
