import { rpc } from "@/platform/db";
import type { ManualBookingRequest } from "../domain/manual-booking";
import type { ReserveRejection } from "../domain/rejections";

type ManualReserveResult = { ok: true; booking: { id: string; status: string; price_cents: number; origin: string; terms_accepted_at: string | null } } | { ok: false; reason: ReserveRejection };

/** One RPC owns validation, the room lock, the customer, the booking and its audit event. */
export const reserveManual = (siteId: string, request: ManualBookingRequest) => rpc<ManualReserveResult>("sauna_reserve_manual", {
  p_site: siteId, p_room: request.roomId, p_starts_at: request.startsAt, p_turn_type: request.turnTypeId, p_kind: request.kind,
  p_name: request.name, p_whatsapp: request.whatsapp, p_request_id: request.requestId, p_expected_price: request.expectedPriceCents,
});
