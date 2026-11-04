"use client";

import { DownloadSimple, Heart } from "@phosphor-icons/react";
import { useDonate, useInstall } from "@/app/recetas/[site]/site-hooks";

/** After copying a Mercado Pago alias: the same message as the recipe sites. */
function DonationNote({ alias }: { alias: string }) {
  return <p className="p-note" role="status">Alias copiado: <strong>{alias}</strong>. Pegalo en Mercado Pago y poné el monto que quieras: la donación es voluntaria. ¡Gracias!</p>;
}

/** The round heart at the top of every page. Nothing when the panel left donations empty. */
export function HeaderDonate({ donation }: { donation: string }) {
  const { donate, copied } = useDonate(donation);
  if (!donation) return null;
  return <div className="p-top">
    <button type="button" className="p-heart" aria-label="Hacer una donación" title="Hacer una donación" onClick={() => void donate()}><Heart size={22} weight="bold" aria-hidden="true" /></button>
    {copied && <DonationNote alias={donation} />}
  </div>;
}

/** Install button (only where the browser can install the site; iPhone has no prompt, so it explains the steps) and donation button, at the end of every page. */
export function FooterActions({ donation }: { donation: string }) {
  const { canInstall, install, help } = useInstall();
  const { donate, copied } = useDonate(donation);
  if (!canInstall && !donation) return null;
  return <div className="p-actions">
    {canInstall && <button type="button" className="p-button" onClick={() => void install()}><DownloadSimple size={20} aria-hidden="true" />Instalar la app</button>}
    {donation && <button type="button" className="p-button" onClick={() => void donate()}><Heart size={20} aria-hidden="true" />Hacer una donación</button>}
    {help && <p className="p-note" role="status">En iPhone: tocá Compartir y elegí «Agregar a inicio».</p>}
    {copied && <DonationNote alias={donation} />}
  </div>;
}
