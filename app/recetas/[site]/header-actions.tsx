"use client";

import { DownloadSimple, Heart, InstagramLogo } from "@phosphor-icons/react";
import { DonationNote, InstallHelp } from "./site-notes";
import { useDonate, useInstall } from "./site-hooks";

/**
 * The site's own actions, on the right of the header: Instagram (when set in the panel), donating (lilac, like the
 * footer's button) and installing the app (only where the browser can). Icons on phones; install keeps its words on desktop.
 */
export function HeaderActions({ instagram, donation }: { instagram: string; donation: string }) {
  const { canInstall, install, help, closeHelp } = useInstall();
  const { donate, copied, closeCopied } = useDonate(donation);
  if (!instagram && !donation && !canInstall) return null;
  return <div className="r-head-actions">
    {instagram && <a className="r-icon-button" href={`https://www.instagram.com/${instagram}`} target="_blank" rel="noopener noreferrer"
      aria-label={`Instagram: @${instagram}`} title={`@${instagram}`}><InstagramLogo size={20} aria-hidden="true" /></a>}
    {donation && <button type="button" className="r-icon-button r-icon-donate" aria-label="Hacer una donación" title="Hacer una donación" onClick={() => void donate()}>
      <Heart size={20} weight="bold" aria-hidden="true" />
    </button>}
    {canInstall && <button type="button" className="r-button r-primary r-head-install" onClick={() => void install()} aria-label="Instalar la app">
      <DownloadSimple size={18} weight="bold" aria-hidden="true" /><span>Instalar app</span>
    </button>}
    {help && <InstallHelp className="r-head-note" onClose={closeHelp} />}
    {copied && <DonationNote className="r-head-note" alias={donation} onClose={closeCopied} />}
  </div>;
}
