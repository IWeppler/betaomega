"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/**
 * Installing the public site as an app (manifest in app/sauna/[site]/manifest.webmanifest). Chrome and Android hand over their prompt; an iPhone has
 * none, so the button shows the steps instead. Nothing is shown once installed or where the browser offers no way to install.
 */
export function InstallApp({ className, helpClassName }: { className: string; helpClassName: string }) {
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
    // The footer and the menu each keep the same prompt, and it can only be shown once: the second one just fails.
    try { await prompt.prompt(); await prompt.userChoice; } catch { /* already used */ }
    setPrompt(null);
  };

  return <>
    <button type="button" className={className} onClick={() => void install()}>
      <Download size={16} strokeWidth={1.5} aria-hidden="true" />Descargar la app
    </button>
    {help && <p role="status" className={helpClassName}>En iPhone: tocá Compartir y elegí «Agregar a inicio».</p>}
  </>;
}
