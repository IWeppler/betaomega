"use client";

import type { ReactNode } from "react";

/**
 * Shares a page with the phone's share sheet; where there is none (most computers), opens WhatsApp with the title and the link.
 * `path` is relative to the site's origin; without it, the page being viewed (with its search, so a filtered list is shared as seen).
 * `title` defaults to the page's title. A cancelled share sheet does nothing.
 * Unstyled: each site passes its own classes and content. With an icon only, pass `label`: it becomes the accessible name and tooltip.
 */
export function ShareButton({ path, title, label, className, children }: { path?: string; title?: string; label?: string; className?: string; children: ReactNode }) {
  const share = async () => {
    const url = `${window.location.origin}${path ?? `${window.location.pathname}${window.location.search}`}`;
    const text = title ?? document.title;
    if (navigator.share) {
      try {
        await navigator.share({ title: text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Any other failure (not allowed here, nothing to share with) falls back to WhatsApp.
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`, "_blank", "noopener,noreferrer");
  };
  return <button type="button" className={className} aria-label={label} title={label} onClick={() => void share()}>{children}</button>;
}
