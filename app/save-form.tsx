"use client";

import { useCallback, useEffect, useId, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Check, LoaderCircle } from "lucide-react";

import { showToast, toastCount } from "@/shared/ui/toast";

type LeaveChoice = "save" | "discard" | "stay";

/**
 * Edit form that saves only when the person presses Guardar. Leaving it with unsaved changes
 * (closing it, picking another item, changing section) asks whether to save, discard or stay.
 */
export function SaveForm({
  children,
  onSave,
  onDiscard,
  changes,
  registerRef,
  paused,
  error,
}: {
  /** Last save error, shown next to the status so it is visible without scrolling. */
  error?: string;
  children: ReactNode;
  onDiscard?: () => void;
  onSave: (form: HTMLFormElement) => Promise<boolean>;
  /** Serialized state kept outside the inputs (images, rows…): a change marks the form as modified. */
  changes: string;
  paused: boolean;
  /** Called before leaving the form. Resolves true when it is fine to leave (saved, discarded or nothing changed). */
  registerRef: MutableRefObject<() => Promise<boolean>>;
}) {
  const titleId = useId();
  const textId = useId();
  const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const save = useRef(onSave);
  const discard = useRef(onDiscard);
  const pausedRef = useRef(paused);
  const dirty = useRef(false);
  const flight = useRef<Promise<boolean> | null>(null);
  const previous = useRef(changes);
  const answer = useRef<((choice: LeaveChoice) => void) | null>(null);
  const [status, setStatus] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [modified, setModified] = useState(false);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    save.current = onSave;
    discard.current = onDiscard;
    pausedRef.current = paused;
  });

  const markDirty = useCallback(() => {
    dirty.current = true;
    setModified(true);
    setStatus("dirty");
  }, []);
  const submit = useCallback(async (): Promise<boolean> => {
    if (flight.current) return flight.current;
    if (pausedRef.current || !form.current) return false;
    // Whoever saves may report it with its own notice and its "Deshacer": then this one stays quiet.
    const before = toastCount();
    const pending = save.current(form.current).catch(() => false);
    flight.current = pending;
    setStatus("saving");
    const success = await pending;
    flight.current = null;
    if (success) { dirty.current = false; setModified(false); }
    setStatus(success ? "saved" : "error");
    if (success && toastCount() === before) showToast("Se guardó correctamente.");
    return success;
  }, []);
  const leave = useCallback(async (): Promise<boolean> => {
    if (flight.current) return flight.current;
    if (pausedRef.current) return false;
    if (!dirty.current) return true;
    const choice = await new Promise<LeaveChoice>(resolve => {
      answer.current = resolve;
      setAsking(true);
    });
    if (choice === "stay") return false;
    if (choice === "discard") {
      dirty.current = false;
      setModified(false);
      setStatus("idle");
      discard.current?.();
      return true;
    }
    return submit();
  }, [submit]);
  const choose = (choice: LeaveChoice) => {
    const resolve = answer.current;
    answer.current = null;
    setAsking(false);
    resolve?.(choice);
  };

  useEffect(() => {
    registerRef.current = leave;
    return () => {
      registerRef.current = async () => true;
    };
  }, [leave, registerRef]);
  useEffect(() => {
    if (previous.current !== changes) {
      previous.current = changes;
      markDirty();
    }
  }, [changes, markDirty]);
  useEffect(() => {
    const element = dialog.current;
    if (asking && element && !element.open) element.showModal();
    if (!asking && element?.open) element.close();
  }, [asking]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current || flight.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return (
    <form
      ref={form}
      onChange={markDirty}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <fieldset className="autosave-fields" disabled={status === "saving"}>
        {children}
      </fieldset>
      <div className="form-actions">
        <button className="button primary" type="submit" aria-busy={status === "saving"} disabled={status === "saving" || paused}>
          {status === "saving" && <LoaderCircle size={16} className="motion-safe:animate-spin" aria-hidden="true" />}
          {status === "saved" && <Check size={16} aria-hidden="true" />}
          {status === "saving" ? "Guardando…" : status === "saved" ? "Guardado" : "Guardar"}
        </button>
        {onDiscard && modified && <button type="button" className="min-h-control rounded-control border border-line-strong bg-surface px-4 font-medium text-ink hover:bg-sunken" disabled={status === "saving" || paused} onClick={onDiscard}>Descartar cambios</button>}
        <div className="save-feedback">
          <p className={`autosave-status ${status}`} role="status">
            {status === "error" ? "No se guardaron los cambios." : ""}
          </p>
          {status === "error" && error && (
            <p className="autosave-status error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
      <dialog
        ref={dialog}
        className="bulk-dialog leave-dialog"
        aria-labelledby={titleId}
        aria-describedby={textId}
        onCancel={(event) => {
          event.preventDefault();
          choose("stay");
        }}
      >
        <div className="bulk-dialog-body">
          <h3 id={titleId}>Hay cambios sin guardar</h3>
          <p id={textId}>Si salís sin guardar, se pierden los cambios que hiciste en este formulario.</p>
          <div className="leave-actions">
            <button type="button" className="button primary" onClick={() => choose("save")}>Guardar y salir</button>
            <button type="button" className="button danger" onClick={() => choose("discard")}>Salir sin guardar</button>
            <button type="button" className="button" autoFocus onClick={() => choose("stay")}>Seguir editando</button>
          </div>
        </div>
      </dialog>
    </form>
  );
}
