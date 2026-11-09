import { equal } from "@/platform/auth/server";
import { rpc, siteTable } from "@/platform/db";
import type { AgendaBooking } from "../domain/agenda";
import type { Plan, PlanDraft } from "../domain/plans";
import type { PolicyRule } from "../domain/policy";
import type { PaymentMethod } from "../domain/payments";
import type { PaymentOutcome, PlanRejection, ReserveRejection, TransferRejection } from "../domain/rejections";
import { SetupConflictError } from "./setup";
import { agendaBooking, fullBooking, type BookingRow } from "./bookings";

const missing = "Faltan las tablas de planes: corré supabase/schema.sql.";

type PlanRow = { id: string; name: string; description: string; turns: number; price_cents: number; window_days: number; active: boolean; updated_at: string };
type PurchaseRow = { id: string; token: string; name: string; turns: number; price_cents: number; deposit_cents: number; created_at: string };

const plans = (siteId: string) => siteTable<PlanRow>("sauna_plans", siteId, missing);
const purchases = (siteId: string) => siteTable<PurchaseRow>("sauna_plan_purchases", siteId, missing);

const planFrom = (row: PlanRow): Plan => ({
  id: row.id, name: row.name, description: row.description, turns: row.turns, priceCents: Number(row.price_cents), windowDays: row.window_days, active: row.active, updatedAt: row.updated_at,
});

/** Every plan for the panel; only the active ones for the public site. Cheapest first. */
export const listPlans = async (siteId: string, { activeOnly = false } = {}) =>
  (await plans(siteId)(`${activeOnly ? "active=is.true&" : ""}select=*&order=price_cents.asc`)).map(planFrom);

/** Plans are deactivated, never deleted: past purchases point to them. Pattern 4 with the row's own updated_at. */
export async function savePlan(siteId: string, plan: PlanDraft): Promise<void> {
  const fields = { name: plan.name, description: plan.description, turns: plan.turns, price_cents: plan.priceCents, window_days: plan.windowDays, active: plan.active };
  if (!plan.id) {
    await plans(siteId)("", { method: "POST", body: JSON.stringify(fields) });
    return;
  }
  const [row] = await plans(siteId)(`id=eq.${plan.id}&updated_at=eq.${encodeURIComponent(plan.updatedAt ?? "")}`, { method: "PATCH", body: JSON.stringify(fields) });
  if (!row) throw new SetupConflictError();
}

export type PlanTurnRequest = { roomId: string; turnTypeId: string; startsAt: string };
export type ReservePlanResult = { ok: true; token: string } | { ok: false; reason: PlanRejection | ReserveRejection };

export const reservePlan = (siteId: string, request: { planId: string; turns: PlanTurnRequest[]; name: string; whatsapp: string; termsAccepted: boolean }) =>
  rpc<ReservePlanResult>("sauna_reserve_plan", {
    p_site: siteId, p_plan: request.planId, p_name: request.name, p_whatsapp: request.whatsapp, p_terms_accepted: request.termsAccepted,
    p_turns: request.turns.map(turn => ({ room_id: turn.roomId, turn_type_id: turn.turnTypeId, starts_at: turn.startsAt })),
  });

export type PlanPurchase = {
  id: string;
  name: string;
  turns: number;
  priceCents: number;
  depositCents: number;
  /** Its turns, earliest first. */
  bookings: AgendaBooking[];
  rules: PolicyRule[];
};

async function purchaseWithBookings(siteId: string, row: PurchaseRow): Promise<PlanPurchase> {
  const rows = await siteTable<BookingRow>("sauna_bookings", siteId, missing)(`plan_purchase_id=eq.${row.id}&${fullBooking}`);
  const bookings = rows.map(agendaBooking).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return {
    id: row.id, name: row.name, turns: row.turns, priceCents: Number(row.price_cents), depositCents: Number(row.deposit_cents), bookings,
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
