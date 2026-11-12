"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const KEY = "sauna-splash";
const HOLD = 1300;
const LEAVE = 1000;
const LIMIT = 4000;

/**
 * The opening: on the first visit of a session, the page is covered by the brand's logo while it loads, then the cover lifts.
 * Only the home page gets it, and never for people who asked for less motion.
 * The cover is part of the server HTML so the page never shows underneath it; a script that runs before the first paint hides it when it should not play.
 */
export function SiteSplash({ logo, name, home }: { logo: string; name: string; home: string }) {
  const cover = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"enter" | "hold" | "leave" | "gone">("enter");
  const root = home.replace(/\/+$/, "");
  const guard = `try{if(sessionStorage.getItem(${JSON.stringify(KEY)})||matchMedia("(prefers-reduced-motion: reduce)").matches||location.pathname.replace(/\\/+$/,"")!==${JSON.stringify(root)})document.currentScript.parentElement.hidden=true}catch(e){}`;

  useEffect(() => {
    const element = cover.current;
    if (!element || element.hidden) { setPhase("gone"); return; }
    try { sessionStorage.setItem(KEY, "1"); } catch { /* private mode: it simply plays again next time */ }
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = "hidden";
    const timers: number[] = [];
    let leaving = false;
    const leave = () => {
      if (leaving) return;
      leaving = true;
      setPhase("leave");
      html.style.overflow = overflow;
      timers.push(window.setTimeout(() => setPhase("gone"), LEAVE));
    };
    const shown = performance.now();
    // Never faster than the logo's own entrance, and not before the page has loaded, but never stuck either.
    const ready = () => timers.push(window.setTimeout(leave, Math.max(0, HOLD - (performance.now() - shown))));
    const frame = requestAnimationFrame(() => setPhase("hold"));
    if (document.readyState === "complete") ready(); else window.addEventListener("load", ready, { once: true });
    timers.push(window.setTimeout(leave, LIMIT));
    return () => { cancelAnimationFrame(frame); timers.forEach(window.clearTimeout); window.removeEventListener("load", ready); html.style.overflow = overflow; };
  }, []);

  if (phase === "gone") return null;
  const leaving = phase === "leave";
  // Two curtains: the cream one holds the logo and lifts first, the dark one behind it follows a beat later, so the page is uncovered in two strokes.
  return <div ref={cover} data-splash="" aria-hidden="true" suppressHydrationWarning className={`fixed inset-0 z-50 ${leaving ? "pointer-events-none" : ""}`}>
    <script dangerouslySetInnerHTML={{ __html: guard }} />
    <noscript><style>{"[data-splash]{display:none}"}</style></noscript>
    <div className={`absolute inset-0 bg-night transition-transform duration-[800ms] delay-150 ease-in-out ${leaving ? "-translate-y-full" : ""}`} />
    <div className={`absolute inset-0 grid place-items-center bg-bg transition-transform duration-[800ms] ease-in-out ${leaving ? "-translate-y-full" : ""}`}>
    <Image src={logo} alt={name} width={1536} height={1024} priority className={`h-auto w-[min(72vw,26rem)] object-contain transition-[opacity,scale] duration-[900ms] ease-standard ${phase === "enter" ? "scale-90 opacity-0" : leaving ? "scale-105 opacity-0" : "scale-100 opacity-100"}`} />
    </div>
  </div>;
}
