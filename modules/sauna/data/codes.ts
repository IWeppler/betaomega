import { siteTable, SupabaseError } from "@/platform/db";
import { countUses, type CodeDraft, type CodeUses, type DiscountCode } from "../domain/codes";
import type { BookingStatus } from "../domain/booking";
import type { CodeType } from "../domain/pricing";

const missing = "Falta la tabla de códigos: corré supabase/schema.sql.";

/** Two codes with the same text, or someone saved this one after it was read. */
export class CodeConflictError extends Error {}

type CodeRow = {
  id: string; code: string; type: CodeType; value: number; max_uses: number | null; max_uses_per_customer: number | null; room_id: string | null;
  turn_type_id: string | null; valid_from: string | null; valid_until: string | null; active: boolean; note: string; updated_at: string;
};
type UseRow = { code_id: string; status: BookingStatus; expires_at: string | null; customer_id: string; plan_purchase_id: string | null };

const codes = (siteId: string) => siteTable<CodeRow>("discount_codes", siteId, missing);
const uses = (siteId: string) => siteTable<UseRow>("sauna_bookings", siteId, missing);
const attempts = (siteId: string) => siteTable<{ id: string }>("sauna_code_attempts", siteId, missing);

/** A code with what the panel needs: its note, its version and how many current bookings use it. */
export type PanelCode = DiscountCode & { note: string; updatedAt: string; uses: number };

const codeFrom = (row: CodeRow): DiscountCode & { note: string; updatedAt: string } => ({
  id: row.id, code: row.code, type: row.type, value: Number(row.value), active: row.active, validFrom: row.valid_from, validUntil: row.valid_until, maxUses: row.max_uses,
  maxUsesPerCustomer: row.max_uses_per_customer, roomId: row.room_id, turnTypeId: row.turn_type_id, note: row.note, updatedAt: row.updated_at,
});

/** Newest first. Uses are counted the way sauna_reserve counts them: current bookings only, so an expired or cancelled one has given its use back. */
export async function listCodes(siteId: string): Promise<PanelCode[]> {
  const [rows, used] = await Promise.all([
    codes(siteId)("select=*&order=created_at.desc&limit=500"),
    uses(siteId)("code_id=not.is.null&select=code_id,status,expires_at,customer_id,plan_purchase_id&limit=10000"),
  ]);
  const now = new Date().toISOString();
  return rows.map(row => ({ ...codeFrom(row), uses: countUses(used.filter(use => use.code_id === row.id).map(use => ({ status: use.status, expiresAt: use.expires_at, customerId: use.customer_id, planPurchaseId: use.plan_purchase_id })), null, now).total }));
}

/** Codes are stored in capitals and their text is checked before (isCodeText), so this equality has nothing to escape. */
export async function findCode(siteId: string, text: string): Promise<DiscountCode | null> {
  const [row] = await codes(siteId)(`code=eq.${encodeURIComponent(text)}&select=*`);
  return row ? codeFrom(row) : null;
}

/** For the preview only, without locks: sauna_reserve counts again under the code's lock, and that is what decides. */
export async function usesOf(siteId: string, codeId: string, whatsapp: string | null): Promise<CodeUses> {
  const rows = await uses(siteId)(`code_id=eq.${codeId}&select=code_id,status,expires_at,customer_id,plan_purchase_id&limit=10000`);
  const customers = whatsapp ? await siteTable<{ id: string }>("customers", siteId, missing)(`whatsapp=eq.${whatsapp}&select=id`) : [];
  return countUses(rows.map(use => ({ status: use.status, expiresAt: use.expires_at, customerId: use.customer_id, planPurchaseId: use.plan_purchase_id })), customers[0]?.id ?? null, new Date().toISOString());
}

/** Resolves to the code's id. */
export async function saveCode(siteId: string, code: CodeDraft): Promise<string> {
  const fields = {
    code: code.code, type: code.type, value: code.value, max_uses: code.maxUses, max_uses_per_customer: code.maxUsesPerCustomer, room_id: code.roomId,
    turn_type_id: code.turnTypeId, valid_from: code.validFrom, valid_until: code.validUntil, active: code.active, note: code.note,
  };
  try {
    if (!code.id) {
      const [created] = await codes(siteId)("", { method: "POST", body: JSON.stringify(fields) });
      return created.id;
    }
    // Pattern 4 with the row's own updated_at, which a trigger moves on every change: the filter and the update are one statement.
    const [row] = await codes(siteId)(`id=eq.${code.id}&updated_at=eq.${encodeURIComponent(code.updatedAt ?? "")}`, { method: "PATCH", body: JSON.stringify(fields) });
    if (!row) throw new CodeConflictError("Alguien más cambió este código. Recargá la página antes de guardar.");
    return row.id;
  } catch (error) {
    // 23505: the unique index on the text, without distinguishing case.
    if (error instanceof SupabaseError && error.message.includes("23505")) throw new CodeConflictError(`Ya hay un código ${code.code}. Elegí otro texto.`);
    throw error;
  }
}

/** Only to undo creating a code, while no booking used it: their foreign key refuses the rest, and then it is deactivated. Resolves to whether it was deleted. */
export async function deleteUnusedCode(siteId: string, id: string): Promise<boolean> {
  try {
    await codes(siteId)(`id=eq.${id}`, { method: "DELETE" });
    return true;
  } catch (error) {
    if (!(error instanceof SupabaseError && error.message.includes("23503"))) throw error;
    await codes(siteId)(`id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ active: false }) });
    return false;
  }
}

const HOUR = 3_600_000;

/** Failed attempts of one origin in the last hour. */
export async function failedAttempts(siteId: string, originHash: string): Promise<number> {
  const since = encodeURIComponent(new Date(Date.now() - HOUR).toISOString());
  return (await attempts(siteId)(`origin_hash=eq.${originHash}&created_at=gte.${since}&select=id&limit=100`)).length;
}

/** Records a failure and clears what is older than a day, so the table stays small without a scheduled task. */
export async function recordFailedAttempt(siteId: string, originHash: string): Promise<void> {
  await attempts(siteId)("", { method: "POST", body: JSON.stringify({ origin_hash: originHash }) });
  const dayAgo = encodeURIComponent(new Date(Date.now() - 24 * HOUR).toISOString());
  await attempts(siteId)(`created_at=lt.${dayAgo}`, { method: "DELETE" });
}

/** Every turn type, inactive ones too: a code restricted to a type that was later removed can still be edited. */
export async function turnTypeIds(siteId: string): Promise<string[]> {
  return (await siteTable<{ id: string }>("sauna_turn_types", siteId, missing)("select=id")).map(row => row.id);
}
