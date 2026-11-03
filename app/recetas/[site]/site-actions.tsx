"use client";

import { Printer, ShareNetwork } from "@phosphor-icons/react";
import { trackShare } from "./track";

/**
 * Shares the page with the phone's share sheet; where there is none (most computers), opens WhatsApp.
 * With `siteId` every share is counted (by channel, and by recipe when it has one); a cancelled share sheet is not a share.
 * `iconOnly` draws a round icon button: the label stays as its accessible name and tooltip.
 */
export function ShareButton({ path, text, label = "Compartir", siteId, recipeId, iconOnly = false }: { path: string; text: string; label?: string; siteId?: string; recipeId?: string; iconOnly?: boolean }) {
  const share = async () => {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: text, url });
        if (siteId) trackShare(siteId, "nativo", recipeId);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    if (siteId) trackShare(siteId, "whatsapp", recipeId);
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`, "_blank", "noopener,noreferrer");
  };
  return iconOnly
    ? <button type="button" className="r-icon-button" aria-label={label} title={label} onClick={() => void share()}><ShareNetwork size={20} aria-hidden="true" /></button>
    : <button type="button" className="r-button" onClick={() => void share()}><ShareNetwork size={18} aria-hidden="true" />{label}</button>;
}

export function PrintButton({ iconOnly = false }: { iconOnly?: boolean }) {
  return iconOnly
    ? <button type="button" className="r-icon-button" aria-label="Imprimir" title="Imprimir" onClick={() => window.print()}><Printer size={20} aria-hidden="true" /></button>
    : <button type="button" className="r-button" onClick={() => window.print()}><Printer size={18} aria-hidden="true" />Imprimir</button>;
}
