"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Notice } from "./controls";
import { sendJson } from "./fetch-json";

type Method = "mercadopago" | "transfer";

/**
 * How the person pays the deposit of a held booking. The server checks the booking again and decides the amount: this only says which booking and how.
 * Mercado Pago leaves the page for its checkout; a transfer reloads it with the account's details.
 */
export function PaymentChoice({ siteId, token, mercadopago, transfer }: { siteId: string; token: string; mercadopago: boolean; transfer: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Method | null>(null);
  const [error, setError] = useState("");
  const pay = async (method: Method) => {
    setBusy(method);
    setError("");
    try {
      const answer = await sendJson<{ url?: string }>(`/api/sites/${siteId}/sauna/reservations/payment`, "POST", { token, method });
      if (method === "mercadopago" && answer?.url) {
        window.location.assign(answer.url);
        return; // stays busy while the browser leaves
      }
      router.refresh();
    } catch (failure) { setError((failure as Error).message); }
    setBusy(null);
  };
  return <div className="grid gap-2">
    <div className="flex flex-wrap gap-2">
      {mercadopago && <Button variant="primary" disabled={busy !== null} onClick={() => void pay("mercadopago")}>{busy === "mercadopago" ? "Abriendo Mercado Pago…" : "Pagar con Mercado Pago"}</Button>}
      {transfer && <Button variant={mercadopago ? "quiet" : "primary"} disabled={busy !== null} onClick={() => void pay("transfer")}>{busy === "transfer" ? "Un momento…" : "Pagar por transferencia"}</Button>}
    </div>
    {error && <Notice kind="error">{error}</Notice>}
  </div>;
}
