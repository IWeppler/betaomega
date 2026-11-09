import { equal } from "@/platform/auth/server";
import { rpc, siteTable } from "@/platform/db";
import type { BookingStatus } from "../domain/booking";
import type { Movement, PaymentMethod } from "../domain/payments";
import type { PaymentOutcome, TransferRejection } from "../domain/rejections";

const missing = "Falta la tabla de reservas: corré supabase/schema.sql.";

/** What paying a booking needs to know about it. Server-only: the id never reaches the person's page. */
export type PaymentTarget = {
  id: string;
  token: string;
  status: BookingStatus;
  depositCents: number;
  expiresAt: string | null;
  startsAt: string;
  typeName: string;
  movements: Movement[];
  /** The plan purchase this booking belongs to: then it is paid together with the plan's other turns. */
  planPurchaseId: string | null;
};

type TargetRow = {
  id: string; token: string; status: BookingStatus; deposit_cents: number; expires_at: string | null; plan_purchase_id: string | null;
  sauna_slots: { starts_at: string; sauna_turn_types: { name: string } | null };
  payments: { kind: Movement["kind"]; amount_cents: number }[];
};

const select = "select=id,token,status,deposit_cents,expires_at,plan_purchase_id,sauna_slots!inner(starts_at,sauna_turn_types(name)),payments(kind,amount_cents)";
const targetFrom = (row: TargetRow): PaymentTarget => ({
  id: row.id, token: row.token, status: row.status, depositCents: row.deposit_cents, expiresAt: row.expires_at, startsAt: row.sauna_slots.starts_at,
  typeName: row.sauna_slots.sauna_turn_types?.name ?? "", movements: row.payments.map(payment => ({ kind: payment.kind, amountCents: payment.amount_cents })),
  planPurchaseId: row.plan_purchase_id,
});
const bookings = (siteId: string) => siteTable<TargetRow>("sauna_bookings", siteId, missing);

/** From the person's secret link, checked as bookingByToken does: format first, then a constant-time comparison. */
export async function paymentTargetByToken(siteId: string, token: string): Promise<PaymentTarget | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const [row] = await bookings(siteId)(`token=eq.${token}&${select}`);
  return row && equal(row.token, token) ? targetFrom(row) : null;
}

export async function paymentTargetById(siteId: string, bookingId: string): Promise<PaymentTarget | null> {
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return null;
  const [row] = await bookings(siteId)(`id=eq.${bookingId}&${select}`);
  return row ? targetFrom(row) : null;
}

export type ChooseTransferResult = { ok: true } | { ok: false; reason: TransferRejection };

export const chooseTransfer = (siteId: string, bookingId: string, actor: string) =>
  rpc<ChooseTransferResult>("sauna_choose_transfer", { p_site: siteId, p_booking: bookingId, p_actor: actor });

export type ConfirmPaymentResult = { ok: true; outcome: PaymentOutcome } | { ok: false; reason: string };

/** Idempotent by `ref`: the same payment twice is one row (docs/PATTERNS.md, pattern 12). The function applies the late payment rule on its own. */
export const confirmPayment = (siteId: string, payment: { bookingId: string; ref: string; amountCents: number; method: PaymentMethod; actor: string; raw: unknown }) =>
  rpc<ConfirmPaymentResult>("sauna_confirm_payment", {
    p_site: siteId, p_booking: payment.bookingId, p_provider_ref: payment.ref, p_amount_cents: payment.amountCents, p_method: payment.method, p_actor: payment.actor,
    p_raw: payment.raw ?? null,
  });
