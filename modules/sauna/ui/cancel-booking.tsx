"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { useSite } from "@/platform/panel";
import { Dialog } from "@/shared/ui/dialog";
import { showToast } from "@/shared/ui/toast";
import type { AgendaBooking } from "../domain/agenda";
import { businessTime } from "../domain/time";
import { Button, inputClass, Notice } from "./controls";
import { sendJson } from "./fetch-json";

/** How far a row slides to show its delete button, in px. Matches w-18 on the button. */
const REVEAL = 72;
/** Movement before deciding whether a touch is a horizontal swipe or a vertical scroll, in px. */
const SLOP = 8;

const nameOf = (booking: AgendaBooking) => booking.customerName || "la persona";

/** Asks before cancelling a booking. Cancelling frees the turn; money already collected is not returned from here (same as Cancelar in Reservas). */
export function CancelBookingDialog({ booking, onClose, onChanged }: { booking: AgendaBooking | null; onClose: () => void; onChanged: () => Promise<void> }) {
  const site = useSite();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const close = () => { if (busy) return; setError(""); setNote(""); onClose(); };
  const cancel = async () => {
    if (!booking) return;
    setBusy(true);
    setError("");
    try {
      await sendJson(`/api/sites/${site.id}/sauna/bookings/${booking.id}`, "PATCH", { action: "cancel", note });
      showToast(`Se canceló la reserva de ${nameOf(booking)}.`, 5000);
      setNote("");
      onClose();
      await onChanged();
    } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  };
  return <Dialog open={booking !== null} onOpenChange={open => { if (!open) close(); }} title={booking ? `¿Cancelar la reserva de ${nameOf(booking)}?` : ""}
    description={booking ? `Turno de las ${businessTime(booking.startsAt)}. El turno queda libre. Si ya pagó algo, la devolución se registra aparte.` : undefined}>
    <label className="grid gap-1"><span className="font-semibold text-ink">Motivo (opcional)</span><input className={inputClass} value={note} maxLength={500} onChange={event => setNote(event.target.value)} /></label>
    {error && <Notice kind="error">{error}</Notice>}
    <div className="flex flex-wrap justify-end gap-2">
      <Button disabled={busy} onClick={close}>No, volver</Button>
      <Button variant="danger" disabled={busy} onClick={() => void cancel()}>{busy ? "Cancelando…" : "Sí, cancelar"}</Button>
    </div>
  </Dialog>;
}

/**
 * A row that, on touch screens, slides left to show a delete button. With a mouse the button is a plain icon at the end of the row instead.
 * Without `onDelete` it is a plain row.
 */
export function SwipeRow({ label, onDelete, children }: { label: string; onDelete?: () => void; children: ReactNode }) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const touch = useRef<{ x: number; y: number; base: number; axis: "x" | "y" | null } | null>(null);
  if (!onDelete) return <div className="flex items-center gap-2">{children}</div>;
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    touch.current = { x: event.clientX, y: event.clientY, base: offset, axis: null };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const start = touch.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.axis) {
      if (Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy)) { start.axis = "x"; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); }
      else if (Math.abs(dy) > SLOP) start.axis = "y";
    }
    if (start.axis === "x") setOffset(Math.min(0, Math.max(-REVEAL * 1.25, start.base + dx)));
  };
  const up = () => {
    const swiped = touch.current?.axis === "x";
    touch.current = null;
    setDragging(false);
    if (swiped) setOffset(current => (current < -REVEAL / 2 ? -REVEAL : 0));
  };
  const open = offset !== 0;
  const remove = () => { setOffset(0); onDelete(); };
  return <div className="relative overflow-hidden rounded-control">
    <button type="button" tabIndex={open ? 0 : -1} aria-hidden={!open} aria-label={label} onClick={remove}
      className="absolute inset-y-0 right-0 inline-flex w-18 items-center justify-center bg-danger text-bg pointer-fine:hidden">
      <Trash2 size={20} aria-hidden="true" />
    </button>
    {/* The offset follows the finger, so it can only be an inline value (docs/DESIGN-SYSTEM.md §1). */}
    <div className={`relative flex touch-pan-y items-center gap-2 bg-bg ${dragging ? "" : "transition-transform duration-200 ease-standard"}`} style={{ transform: `translateX(${offset}px)` }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onClickCapture={event => { if (open) { event.preventDefault(); event.stopPropagation(); setOffset(0); } }}>
      {children}
      <button type="button" aria-label={label} title={label} onClick={onDelete}
        className="hidden size-control shrink-0 place-items-center rounded-control text-muted hover:bg-sunken hover:text-danger pointer-fine:inline-grid">
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  </div>;
}
