"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const key = "r-splash";
// Runs before the first paint, marking the page wrapper (the layout sets suppressHydrationWarning on it): skips the splash after the first visit of the session and for people who asked for less motion.
const guard = `try{if(sessionStorage.getItem("${key}")||matchMedia("(prefers-reduced-motion: reduce)").matches)document.currentScript.parentElement.classList.add("r-nosplash")}catch(e){}`;

/**
 * First visit of the session: the logo sits centered over the page, then shrinks and flies to the header's logo (FLIP).
 * Without JS, CSS fades the overlay out by itself, so the page is never left covered.
 */
export function Splash({ logo }: { logo: string }) {
  const overlay = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const root = overlay.current?.closest(".recetas");
    const element = overlay.current;
    const poster = mark.current;
    if (!element || !poster || root?.classList.contains("r-nosplash")) { setDone(true); return; }
    try { sessionStorage.setItem(key, "1"); } catch { /* private mode: the splash simply shows again next time */ }
    let finished = false;
    const finish = () => { if (!finished) { finished = true; setDone(true); } };
    const fly = () => {
      const target = document.querySelector(".r-logo")?.getBoundingClientRect();
      const from = poster.getBoundingClientRect();
      element.classList.add("go");
      if (target && target.width > 0) {
        const scale = target.width / from.width;
        poster.style.transform = `translate(${target.left - from.left}px, ${target.top - from.top}px) scale(${scale})`;
      }
      window.setTimeout(finish, 800);
    };
    // A screen-sized poster deserves a moment longer before it flies.
    const hold = window.setTimeout(fly, 650);
    const safety = window.setTimeout(finish, 2000);
    return () => { window.clearTimeout(hold); window.clearTimeout(safety); };
  }, []);

  if (done) return null;
  return <>
    <script dangerouslySetInnerHTML={{ __html: guard }} />
    <div className="r-splash" ref={overlay} aria-hidden="true">
      <div className="r-splash-mark" ref={mark}>
        <Image src={logo} alt="" width={900} height={1200} unoptimized priority />
      </div>
    </div>
  </>;
}
