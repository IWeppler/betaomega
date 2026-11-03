"use client";

import { ShareNetwork, X } from "@phosphor-icons/react";

/** iPhone has no install prompt: these are the steps. */
export function InstallHelp({ onClose, className = "" }: { onClose: () => void; className?: string }) {
  return <div className={`r-foot-note ${className}`} role="status">
    <p>En iPhone: tocá <ShareNetwork size={16} aria-hidden="true" /> Compartir y elegí «Agregar a inicio».</p>
    <button type="button" aria-label="Cerrar" onClick={onClose}><X size={16} aria-hidden="true" /></button>
  </div>;
}

/** After copying the Mercado Pago alias. */
export function DonationNote({ alias, onClose, className = "" }: { alias: string; onClose: () => void; className?: string }) {
  return <div className={`r-foot-note ${className}`} role="status">
    <p>Alias copiado: <strong>{alias}</strong>. Pegalo en Mercado Pago y poné el monto que quieras: la donación es voluntaria. ¡Gracias!</p>
    <button type="button" aria-label="Cerrar" onClick={onClose}><X size={16} aria-hidden="true" /></button>
  </div>;
}
