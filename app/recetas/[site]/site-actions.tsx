"use client";

import { Printer, ShareNetwork } from "@phosphor-icons/react";

/** Shares the page with the phone's share sheet; where there is none (most computers), opens WhatsApp. */
export function ShareButton({ path, text, label = "Compartir" }: { path: string; text: string; label?: string }) {
  const share = async () => {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try { await navigator.share({ title: text, url }); return; } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`, "_blank", "noopener,noreferrer");
  };
  return <button type="button" className="r-button" onClick={() => void share()}><ShareNetwork size={18} aria-hidden="true" />{label}</button>;
}

export function PrintButton() {
  return <button type="button" className="r-button" onClick={() => window.print()}><Printer size={18} aria-hidden="true" />Imprimir</button>;
}
