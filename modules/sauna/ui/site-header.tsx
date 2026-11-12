"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

// Past this much scroll the header gets its background; past HIDE_AFTER it also leaves on the way down and returns on the way up.
const SOLID_AFTER = 24;
const HIDE_AFTER = 160;
const MIN_STEP = 6;

// Over the hero's photograph the header is bare and its text turns light: the tokens its children read are swapped for the night ones, but not while the phone menu is open (its sheet has its own cream ground).
const overHero = "data-[over=true]:not-has-[[aria-expanded=true]]:[--color-ink:var(--color-night-ink)] data-[over=true]:not-has-[[aria-expanded=true]]:[--color-surface:transparent] data-[over=true]:not-has-[[aria-expanded=true]]:[--color-sunken:rgb(246_237_225/0.14)] data-[over=true]:not-has-[[aria-expanded=true]]:[--color-line-strong:rgb(246_237_225/0.55)] data-[over=true]:not-has-[[aria-expanded=true]]:[--color-accent:var(--color-night-ink)] data-[over=true]:not-has-[[aria-expanded=true]]:[--color-accent-hover:#ffffff] data-[over=true]:not-has-[[aria-expanded=true]]:[--color-accent-ink:#1a1412]";

/**
 * The public site's header. Fixed. On the home page it starts bare over the hero; scrolling gives it a background, scrolling further down tucks it away, and scrolling up brings it back.
 * Other pages have no hero, so it keeps its background there. It never carries a transform while shown, or the phone menu's sheet (fixed) would be confined to it.
 */
export function SiteHeader({ home, children }: { home: string; children: ReactNode }) {
  const pathname = usePathname();
  const strip = (path: string) => path.replace(/\/+$/, "");
  const hasHero = strip(pathname) === strip(home || "/");
  const [top, setTop] = useState(true);
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    last.current = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      const delta = y - last.current;
      setTop(y < SOLID_AFTER);
      if (y < HIDE_AFTER) setHidden(false);
      else if (Math.abs(delta) >= MIN_STEP) setHidden(delta > 0);
      if (Math.abs(delta) >= MIN_STEP || y < HIDE_AFTER) last.current = y;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, []);
  const bare = hasHero && top;
  return <header data-over={bare} className={`${overHero} fixed inset-x-0 top-0 z-20 grid h-20 grid-cols-[1fr_auto_1fr] items-center gap-4 px-[6%] text-ink transition-[translate,background-color,border-color,box-shadow] duration-300 ease-standard focus-within:translate-none has-[[aria-expanded=true]]:translate-none lg:h-24 lg:px-[5%] ${hidden ? "-translate-y-full" : ""} ${bare ? "border-b border-transparent bg-transparent" : "border-b border-line bg-bg shadow-card"}`}>
    {children}
  </header>;
}
