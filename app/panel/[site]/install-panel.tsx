"use client";

import { useEffect, useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/* Installs the admin panel as its own app (manifest in app/panel/manifest.webmanifest). Chrome/Android hand over
   their prompt; iPhone has none, so it shows the steps. Hidden once installed or where there is no way to install. */
export function InstallPanelButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    // Reading the browser after mount avoids a server/client mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone);
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (installed || (!prompt && !ios)) return null;

  const install = async () => {
    if (!prompt) return setHelp(true);
    await prompt.prompt();
    await prompt.userChoice.catch(() => undefined);
    setPrompt(null);
  };

  return <>
    <button type="button" className="button" onClick={() => void install()}><DownloadSimple size={16} aria-hidden="true" />Instalar panel</button>
    {help && <p className="panel-muted panel-card-note" role="status">En iPhone: tocá Compartir y elegí «Agregar a inicio».</p>}
  </>;
}
