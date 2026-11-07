import { formatCents, type Cents } from "../../../platform/money/index.ts";
import type { BookingKind, Instant } from "./booking.ts";
import { businessDate, businessTime, dayLabel } from "./time.ts";

// The WhatsApp messages of docs/SAUNA.md §8. The panel builds them and whoever attends sends them with one tap: nothing is stored or sent automatically.

/** `number` is in the international form cleanWhatsapp produces. */
export const whatsappLink = (number: string, text: string) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

export type MessageBooking = {
  siteName: string;
  customerName: string;
  startsAt: Instant;
  kind: BookingKind;
  seats: number;
  owedCents: Cents;
  /** Absolute address of the person's own booking page. */
  link: string;
};

const when = (startsAt: Instant) => `${dayLabel(businessDate(startsAt))} a las ${businessTime(startsAt)}`;
const what = ({ kind, seats }: MessageBooking) => (kind === "private" ? "la sala completa" : seats === 1 ? "1 lugar" : `${seats} lugares`);
const greeting = ({ customerName }: MessageBooking) => (customerName ? `Hola, ${customerName}.` : "Hola.");
const owed = ({ owedCents }: MessageBooking) => (owedCents > 0 ? ` Queda ${formatCents(owedCents)} para pagar en el lugar.` : "");

export const confirmationMessage = (booking: MessageBooking) =>
  `${greeting(booking)} Tu reserva en ${booking.siteName} está confirmada: ${what(booking)} el ${when(booking.startsAt)}.${owed(booking)} Podés verla acá: ${booking.link}`;

export const reminderMessage = (booking: MessageBooking) =>
  `${greeting(booking)} Te recordamos tu reserva en ${booking.siteName}: ${what(booking)} el ${when(booking.startsAt)}.${owed(booking)} Te esperamos. Tu reserva: ${booking.link}`;

export const cancellationMessage = (booking: MessageBooking) =>
  `${greeting(booking)} Tu reserva en ${booking.siteName} del ${when(booking.startsAt)} quedó cancelada. Si querés, podés hacer otra cuando quieras.`;

/** Sent by the person who booked, from their booking page. */
export const contactMessage = ({ siteName, startsAt, link }: Pick<MessageBooking, "siteName" | "startsAt" | "link">) =>
  `Hola, tengo una consulta sobre mi reserva en ${siteName} del ${when(startsAt)}: ${link}`;

/** The person sends the receipt of their transfer: the text names the amount so whoever attends can match it in the account. */
export const transferProofMessage = ({ siteName, startsAt, link, amountCents }: Pick<MessageBooking, "siteName" | "startsAt" | "link"> & { amountCents: Cents }) =>
  `Hola, te mando el comprobante de la transferencia de ${formatCents(amountCents)} para mi reserva en ${siteName} del ${when(startsAt)}: ${link}`;

export const cancellationRequestMessage =({ siteName, startsAt, link }: Pick<MessageBooking, "siteName" | "startsAt" | "link">) =>
  `Hola, quiero cancelar mi reserva en ${siteName} del ${when(startsAt)}: ${link}`;
