"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";

type LeaveChoice = "save" | "discard" | "stay";

/**
 * Edit form that saves only when the person presses Guardar. Leaving it with unsaved changes
 * (closing it, picking another item, changing section) asks whether to save, discard or stay.
 */
export function SaveForm({
  children,
  onSave,
  changes,
  registerRef,
  paused,
  error,
}: {
  /** Last save error, shown next to the status so it is visible without scrolling. */
  error?: string;
  children: ReactNode;
  onSave: (form: HTMLFormElement) => Promise<boolean>;
  /** Serialized state kept outside the inputs (images, rows…): a change marks the form as modified. */
  changes: string;
  paused: boolean;
  /** Called before leaving the form. Resolves true when it is fine to leave (saved, discarded or nothing changed). */
  registerRef: MutableRefObject<() => Promise<boolean>>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const save = useRef(onSave);
  const pausedRef = useRef(paused);
  const dirty = useRef(false);
  const flight = useRef<Promise<boolean> | null>(null);
  const previous = useRef(changes);
  const answer = useRef<((choice: LeaveChoice) => void) | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [confirmed, setConfirmed] = useState(false);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    save.current = onSave;
    pausedRef.current = paused;
  });

  const markDirty = useCallback(() => {
    dirty.current = true;
    setConfirmed(false);
    setStatus("dirty");
  }, []);
  const submit = useCallback(async (): Promise<boolean> => {
    if (flight.current) return flight.current;
    if (pausedRef.current || !form.current) return false;
    const pending = save.current(form.current).catch(() => false);
    flight.current = pending;
    setStatus("saving");
    const success = await pending;
    flight.current = null;
    if (success) dirty.current = false;
    setStatus(success ? "saved" : "error");
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmed(success);
    if (success) confirmTimer.current = setTimeout(() => setConfirmed(false), 3000);
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
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
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
        <button className="button primary" type="submit" disabled={status === "saving" || paused}>
          {status === "saving" ? "Guardando…" : "Guardar"}
        </button>
        <div className="save-feedback">
          <p className={`autosave-status ${status}`} role="status">
            {status === "dirty"
              ? "Hay cambios sin guardar."
              : status === "saving"
                ? "Guardando…"
                : status === "saved"
                  ? confirmed ? "✓ Se guardó correctamente." : ""
                  : status === "error"
                    ? "No se guardaron los cambios."
                    : ""}
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
        aria-labelledby="leave-title"
        aria-describedby="leave-text"
        onCancel={(event) => {
          event.preventDefault();
          choose("stay");
        }}
      >
        <div className="bulk-dialog-body">
          <h3 id="leave-title">Hay cambios sin guardar</h3>
          <p id="leave-text">Si salís sin guardar, se pierden los cambios que hiciste en este formulario.</p>
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
