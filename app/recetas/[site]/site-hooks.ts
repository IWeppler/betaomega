"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/**
 * Installing the site as an app. Android/desktop Chrome hand over their own prompt; iPhone has none, so `help` asks
 * to show the steps. `canInstall` is false once installed or where the browser offers no way.
 */
export function useInstall() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
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

  const install = async () => {
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice.catch(() => undefined);
      setPrompt(null);
    } else setHelp(true);
  };
  return { canInstall: !installed && (prompt !== null || ios), install, help, closeHelp: () => setHelp(false) };
}

/** The donation: an https link opens; anything else is a Mercado Pago alias, copied so it can be pasted (`copied` shows it). */
export function useDonate(donation: string) {
  const [copied, setCopied] = useState(false);
  const isLink = donation.startsWith("https://");
  const donate = async () => {
    if (isLink) { window.open(donation, "_blank", "noopener,noreferrer"); return; }
    try { await navigator.clipboard.writeText(donation); } catch { /* the alias is shown anyway */ }
    setCopied(true);
  };
  return { donate, copied: copied && !isLink, closeCopied: () => setCopied(false) };
}
