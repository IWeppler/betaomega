"use client";

import { WhatsappIcon } from "@/app/whatsapp-icon";

/** Opens WhatsApp with a message and the page link. `path` is relative to the site origin. */
export function ShareButton({ path, text, label = "Compartir", className = "button" }: { path: string; text: string; label?: string; className?: string }) {
  const share = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${text}: ${window.location.origin}${path}`)}`, "_blank", "noopener,noreferrer");
  return <button className={className} onClick={share}><WhatsappIcon size={20} />{label}</button>;
}
