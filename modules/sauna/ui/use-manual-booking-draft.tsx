"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePanel } from "@/platform/panel";
import { Dialog } from "@/shared/ui/dialog";
import { emptyManualBookingDraft, type ManualBookingDraft } from "../domain/manual-booking";
import { Button } from "./controls";

/** The agenda owns the draft so a live update or a different calendar selection cannot erase personal data. */
export function useManualBookingDraft() {
  const { flushRef, busy, setBusy } = usePanel();
  const [draft, setDraft] = useState(emptyManualBookingDraft);
  const [asking, setAsking] = useState(false);
  const dirty = useRef(false);
  const saving = useRef(false);
  const answer = useRef<((leave: boolean) => void) | null>(null);
  const pending = useRef<Promise<boolean> | null>(null);
  const update = useCallback((next: ManualBookingDraft) => {
    dirty.current = Boolean(next.name || next.whatsapp);
    setDraft(next);
  }, []);
  const leave = useCallback((): Promise<boolean> => {
    if (saving.current) return Promise.resolve(false);
    if (!dirty.current) return Promise.resolve(true);
    if (pending.current) return pending.current;
    pending.current = new Promise(resolve => { answer.current = resolve; });
    setAsking(true);
    return pending.current;
  }, []);
  const choose = useCallback((discard: boolean) => {
    const resolve = answer.current;
    answer.current = null;
    pending.current = null;
    if (discard) update(emptyManualBookingDraft());
    setAsking(false);
    resolve?.(discard);
  }, [update]);
  useEffect(() => {
    flushRef.current = leave;
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current || saving.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      flushRef.current = async () => true;
      answer.current?.(false);
      window.removeEventListener("beforeunload", warn);
    };
  }, [flushRef, leave]);
  const setSaving = useCallback((value: boolean) => { saving.current = value; setBusy(value); }, [setBusy]);
  const clear = useCallback(() => update(emptyManualBookingDraft()), [update]);
  const dialog = <Dialog open={asking} onOpenChange={open => { if (!open) choose(false); }} title="¿Descartar los datos de la reserva?" description="La reserva todavía no se creó. Si salís, se pierden el nombre y el WhatsApp que cargaste.">
    <div className="flex flex-wrap justify-end gap-2">
      <Button onClick={() => choose(false)}>Seguir editando</Button>
      <Button variant="danger" onClick={() => choose(true)}>Descartar y salir</Button>
    </div>
  </Dialog>;
  return { draft, update, discard: leave, dialog, busy, setSaving, clear };
}
