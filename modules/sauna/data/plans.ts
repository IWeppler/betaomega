import { equal } from "@/platform/auth/server";
import { rpc, siteTable, SupabaseError } from "@/platform/db";
import type { AgendaBooking } from "../domain/agenda";
import type { Plan, PlanDraft } from "../domain/plans";
import type { PolicyRule } from "../domain/policy";
import type { PaymentMethod } from "../domain/payments";
import type { PaymentOutcome, PlanRejection, ReserveRejection, TransferRejection } from "../domain/rejections";
import { SetupConflictError } from "./setup";
import { agendaBooking, fullBooking, type BookingRow } from "./bookings";

const missing = "Faltan las tablas de planes: corré supabase/schema.sql.";

type PlanRow = {
  id: string; name: string; description: string; turns: number; price_cents: number; window_days: number; duration_minutes: number | null; allows_codes: boolean; active: boolean;
  updated_at: string;
};
type PurchaseRow = { id: string; token: string; name: string; turns: number; price_cents: number; discount_cents: number; deposit_cents: number; created_at: string };

const plans = (siteId: string) => siteTable<PlanRow>("sauna_plans", siteId, missing);
const purchases = (siteId: string) => siteTable<PurchaseRow>("sauna_plan_purchases", siteId, missing);

const planFrom = (row: PlanRow): Plan => ({
  id: row.id, name: row.name, description: row.description, turns: row.turns, priceCents: Number(row.price_cents), windowDays: row.window_days,
  // Before schema.sql runs again the columns are missing: a plan then takes any length and no code, as before.
  durationMinutes: row.duration_minutes ?? null, allowsCodes: row.allows_codes === true, active: row.active, updatedAt: row.updated_at,
});

/** Every plan for the panel; only the active ones for the public site. Cheapest first. */
export const listPlans = async (siteId: string, { activeOnly = false } = {}) =>
  (await plans(siteId)(`${activeOnly ? "active=is.true&" : ""}select=*&order=price_cents.asc`)).map(planFrom);

/** Plans are deactivated, never deleted: past purchases point to them. Pattern 4 with the row's own updated_at. Resolves to the plan's id. */
export async function savePlan(siteId: string, plan: PlanDraft): Promise<string> {
  const fields = {
    name: plan.name, description: plan.description, turns: plan.turns, price_cents: plan.priceCents, window_days: plan.windowDays, duration_minutes: plan.durationMinutes,
    allows_codes: plan.allowsCodes, active: plan.active,
  };
  if (!plan.id) {
    const [created] = await plans(siteId)("", { method: "POST", body: JSON.stringify(fields) });
    return created.id;
  }
  const [row] = await plans(siteId)(`id=eq.${plan.id}&updated_at=eq.${encodeURIComponent(plan.updatedAt ?? "")}`, { method: "PATCH", body: JSON.stringify(fields) });
  if (!row) throw new SetupConflictError();
  return row.id;
}

/**
 * Only to undo creating a plan, while no one has bought it: the purchases' foreign key refuses the rest, and then it is deactivated instead.
 * Resolves to whether it was deleted.
 */
export async function deleteUnusedPlan(siteId: string, id: string): Promise<boolean> {
  try {
    await plans(siteId)(`id=eq.${id}`, { method: "DELETE" });
    return true;
  } catch (error) {
    if (!(error instanceof SupabaseError && error.message.includes("23503"))) throw error;
    await plans(siteId)(`id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ active: false }) });
    return false;
  }
}

export type PlanTurnRequest = { roomId: string; turnTypeId: string; startsAt: string };
export type ReservePlanResult = { ok: true; token: string } | { ok: false; reason: PlanRejection | ReserveRejection };

export const reservePlan = (siteId: string, request: { planId: string; turns: PlanTurnRequest[]; name: string; whatsapp: string; termsAccepted: boolean; code: string | null }) =>
  rpc<ReservePlanResult>("sauna_reserve_plan", {
    p_site: siteId, p_plan: request.planId, p_name: request.name, p_whatsapp: request.whatsapp, p_terms_accepted: request.termsAccepted, p_code: request.code,
    p_turns: request.turns.map(turn => ({ room_id: turn.roomId, turn_type_id: turn.turnTypeId, starts_at: turn.startsAt })),
  });

export type PlanPurchase = {
  id: string;
  name: string;
  turns: number;
  /** The plan's price, before the discount. */
  priceCents: number;
  discountCents: number;
  depositCents: number;
  /** Its turns, earliest first. */
  bookings: AgendaBooking[];
  rules: PolicyRule[];
};

async function purchaseWithBookings(siteId: string, row: PurchaseRow): Promise<PlanPurchase> {
  const rows = await siteTable<BookingRow>("sauna_bookings", siteId, missing)(`plan_purchase_id=eq.${row.id}&${fullBooking}`);
  const bookings = rows.map(agendaBooking).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return {
    id: row.id, name: row.name, turns: row.turns, priceCents: Number(row.price_cents), discountCents: Number(row.discount_cents ?? 0), depositCents: Number(row.deposit_cents), bookings,
    rules: rows[0]?.policy_snapshot.rules ?? [],
  };
}

/** A purchase from its secret link, checked as bookingByToken does: format first, then a constant-time comparison. Server-only: it carries ids. */
export async function planPurchaseByToken(siteId: string, token: string): Promise<PlanPurchase | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const [row] = await purchases(siteId)(`token=eq.${token}&select=*`);
  return row && equal(row.token, token) ? purchaseWithBookings(siteId, row) : null;
}

export async function planPurchaseById(siteId: string, purchaseId: string): Promise<PlanPurchase | null> {
  if (!/^[0-9a-f-]{36}$/i.test(purchaseId)) return null;
  const [row] = await purchases(siteId)(`id=eq.${purchaseId}&select=*`);
  return row ? purchaseWithBookings(siteId, row) : null;
}

export const choosePlanTransfer = (siteId: string, purchaseId: string, actor: string) =>
  rpc<{ ok: true } | { ok: false; reason: TransferRejection }>("sauna_plan_choose_transfer", { p_site: siteId, p_purchase: purchaseId, p_actor: actor });

/** Idempotent by `ref`, like confirmPayment: each turn records its share under `ref:<booking>`. */
export const confirmPlanPayment = (siteId: string, payment: { purchaseId: string; ref: string; amountCents: number; method: PaymentMethod; actor: string; raw: unknown }) =>
  rpc<{ ok: true; outcome: PaymentOutcome } | { ok: false; reason: string }>("sauna_confirm_plan_payment", {
    p_site: siteId, p_purchase: payment.purchaseId, p_provider_ref: payment.ref, p_amount_cents: payment.amountCents, p_method: payment.method, p_actor: payment.actor,
    p_raw: payment.raw ?? null,
  });
