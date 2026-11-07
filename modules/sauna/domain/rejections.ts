// Why a reservation can be refused and what a received payment ended up doing. public.sauna_reserve and public.sauna_confirm_payment return
// these same strings: modules/sauna/schema.test.ts fails if the lists and supabase/schema.sql drift apart.

export const reserveRejections = [
  "not_configured", "invalid_request", "terms_not_accepted", "invalid_customer", "no_policy",
  "too_soon", "too_far", "no_slot", "closed",
  "kind_not_offered", "invalid_seats", "full", "not_empty",
  "code_not_found", "code_inactive", "code_not_started", "code_expired", "code_wrong_slot", "code_exhausted", "code_customer_limit",
  "pack_not_found", "pack_not_active", "pack_with_code", "pack_shared_only", "pack_expired", "pack_no_sessions", "pack_week_limit",
] as const;
export type ReserveRejection = (typeof reserveRejections)[number];

/** What the person reads. Typed over the list, so a new reason without its message does not compile. */
export const rejectionMessages: Record<ReserveRejection, string> = {
  not_configured: "Las reservas todavía no están disponibles.",
  invalid_request: "No pudimos procesar la reserva. Recargá la página y probá de nuevo.",
  terms_not_accepted: "Para reservar tenés que aceptar los términos y declarar que tenés 18 años o más.",
  invalid_customer: "Revisá tu nombre y tu WhatsApp.",
  no_policy: "Las reservas todavía no están disponibles.",
  too_soon: "Ese turno ya no se puede reservar: falta muy poco para que empiece.",
  too_far: "Ese turno todavía no se puede reservar.",
  no_slot: "Ese turno ya no está disponible. Elegí otro.",
  closed: "Ese turno está cerrado. Elegí otro.",
  kind_not_offered: "Ese turno no ofrece esa modalidad. Elegí otra.",
  invalid_seats: "Elegí cuántos lugares querés.",
  full: "Ese turno ya se reservó. Elegí otro.",
  not_empty: "Ese turno ya se reservó. Elegí otro.",
  code_not_found: "Ese código no existe.",
  code_inactive: "Ese código no está activo.",
  code_not_started: "Ese código todavía no está vigente.",
  code_expired: "Ese código ya venció.",
  code_wrong_slot: "Ese código no vale para este turno.",
  code_exhausted: "Ese código ya no tiene usos disponibles.",
  code_customer_limit: "Ya usaste ese código todas las veces que se puede.",
  pack_not_found: "No encontramos ese pack.",
  pack_not_active: "Ese pack todavía no está activo.",
  pack_with_code: "Un código no se puede usar junto con un pack.",
  pack_shared_only: "Un pack sirve para un lugar en un turno compartido.",
  pack_expired: "Ese turno es posterior al vencimiento de tu pack.",
  pack_no_sessions: "Tu pack no tiene más sesiones.",
  pack_week_limit: "Ya llegaste al máximo de sesiones de esa semana.",
};

export type WindowRejection = Extract<ReserveRejection, "too_soon" | "too_far">;
export type SeatRejection = Extract<ReserveRejection, "kind_not_offered" | "invalid_seats" | "full" | "not_empty">;
export type CodeRejection = Extract<ReserveRejection, `code_${string}`>;
export type PackRejection = Extract<ReserveRejection, `pack_${string}`>;

export const paymentOutcomes = ["duplicate", "confirmed", "late_confirmed", "no_seat", "amount_mismatch", "unapplied"] as const;
export type PaymentOutcome = (typeof paymentOutcomes)[number];
