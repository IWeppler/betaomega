"use client";

import { DownloadSimple, Heart } from "@phosphor-icons/react";
import { DonationNote, InstallHelp } from "./site-notes";
import { useDonate, useInstall } from "./site-hooks";

/** Install button and donation button, at the end of every page. */
export function FooterActions({ donation }: { donation: string }) {
  const { canInstall, install, help, closeHelp } = useInstall();
  const { donate, copied, closeCopied } = useDonate(donation);
  if (!canInstall && !donation) return null;
  return <div className="r-foot-actions">
    <div className="r-foot-buttons">
      {canInstall && <button type="button" className="r-button r-primary" onClick={() => void install()}><DownloadSimple size={18} aria-hidden="true" />Instalar la app</button>}
      {donation && <button type="button" className="r-button r-donate" onClick={() => void donate()}><Heart size={18} aria-hidden="true" />Hacer una donación</button>}
    </div>
    {help && <InstallHelp onClose={closeHelp} />}
    {copied && <DonationNote alias={donation} onClose={closeCopied} />}
  </div>;
}
