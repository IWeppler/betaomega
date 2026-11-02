"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LockKey } from "@phosphor-icons/react";
import { api } from "@/app/admin-fields";

export function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: new FormData(event.currentTarget).get("password") }) });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return <main className="panel-login">
    <div className="panel-login-card">
      <p className="panel-wordmark">Betayomega</p>
      <h1>Ingresar al panel</h1>
      <p className="panel-muted">Administrá todos tus sitios desde un solo lugar.</p>
      <form onSubmit={submit}>
        <label className="field">
          <span>Contraseña</span>
          <input name="password" type="password" required autoComplete="current-password" autoFocus maxLength={512} aria-describedby={error ? "login-error" : undefined} aria-invalid={error ? true : undefined} />
          {error && <small id="login-error" className="field-error" role="alert">{error}</small>}
        </label>
        <button className="button primary full" disabled={busy}><LockKey size={18} aria-hidden="true" />{busy ? "Ingresando…" : "Ingresar"}</button>
      </form>
    </div>
  </main>;
}
