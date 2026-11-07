import { isCurrent, type BookingStatus, type Instant } from "./booking.ts";
import type { CodeEffect } from "./pricing.ts";
import type { CodeRejection } from "./rejections.ts";

export type DiscountCode = CodeEffect & {
  id: string;
  code: string;
  active: boolean;
  validFrom: Instant | null;
  validUntil: Instant | null;
  /** Always set for a "free" code (docs/SAUNA.md §4); the table enforces it too. */
  maxUses: number | null;
  maxUsesPerCustomer: number | null;
  roomId: string | null;
  turnTypeId: string | null;
};

/** What a person types: case and surrounding spaces do not matter. */
export const normalizeCode = (text: string) => text.trim().toUpperCase();

export type CodeUses = { total: number; byCustomer: number };

/**
 * Uses are counted, never stored: only current bookings count, so an expired or cancelled one gives its use back with no scheduled task.
 * Pass the bookings that carry this code, read under the code's lock. A customer not yet registered has no id and no uses.
 */
export function countUses(bookings: readonly { status: BookingStatus; expiresAt: Instant | null; customerId: string }[], customerId: string | null, now: Instant): CodeUses {
  const current = bookings.filter(booking => isCurrent(booking, now));
  return { total: current.length, byCustomer: current.filter(booking => booking.customerId === customerId).length };
}

/** Null when the code applies to this turn and person. Checked when reserving, in the same transaction that takes the seats. */
export function checkCode(code: DiscountCode, turn: { roomId: string; turnTypeId: string }, uses: CodeUses, now: Instant): CodeRejection | null {
  const current = Date.parse(now);
  if (!code.active) return "code_inactive";
  if (code.validFrom !== null && current < Date.parse(code.validFrom)) return "code_not_started";
  if (code.validUntil !== null && current > Date.parse(code.validUntil)) return "code_expired";
  if (code.roomId !== null && code.roomId !== turn.roomId) return "code_wrong_slot";
  if (code.turnTypeId !== null && code.turnTypeId !== turn.turnTypeId) return "code_wrong_slot";
  if (code.maxUses !== null && uses.total >= code.maxUses) return "code_exhausted";
  if (code.maxUsesPerCustomer !== null && uses.byCustomer >= code.maxUsesPerCustomer) return "code_customer_limit";
  return null;
}
