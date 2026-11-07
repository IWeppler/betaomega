"use client";

import { useEffect } from "react";

/** Only section links are animated: wheel/touch scrolling and the booking hash retain their native behavior. */
export function SiteMotion() {
  useEffect(() => {
    const html = document.documentElement;
    const theme = document.querySelector<HTMLElement>('[data-theme="sauna"]');
    const previous = { colorScheme: html.style.colorScheme, scrollbarColor: html.style.scrollbarColor };
    if (theme) {
      const tokens = getComputedStyle(theme);
      html.style.colorScheme = "dark";
      html.style.scrollbarColor = `${tokens.getPropertyValue("--color-line-strong").trim()} ${tokens.getPropertyValue("--color-bg").trim()}`;
    }
    let frame = 0;
    const cancel = () => cancelAnimationFrame(frame);
    const key = (event: KeyboardEvent) => { if (["Escape", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) cancel(); };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('[data-theme="sauna"] a[href]');
      if (!link || link.target || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !url.hash || url.hash === "#reservar") return;
      let target: HTMLElement | null;
      try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch { return; }
      if (!target) return;
      event.preventDefault(); cancel();
      if (location.hash !== url.hash) history.pushState(history.state, "", url.hash);
      const start = window.scrollY;
      const end = Math.max(0, Math.min(start + target.getBoundingClientRect().top - 24, document.documentElement.scrollHeight - innerHeight));
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const focus = () => {
        if (event.detail !== 0 || !target) return;
        const hadIndex = target.hasAttribute("tabindex");
        if (!hadIndex) { target.tabIndex = -1; target.addEventListener("blur", () => target?.removeAttribute("tabindex"), { once: true }); }
        target.focus({ preventScroll: true });
      };
      if (reduced) { window.scrollTo({ top: end, behavior: "instant" }); focus(); return; }
      const duration = Math.min(850, 400 + Math.abs(end - start) * 0.12);
      const began = performance.now();
      const step = (now: number) => {
        const progress = Math.min((now - began) / duration, 1);
        window.scrollTo({ top: start + (end - start) * (1 - Math.pow(1 - progress, 4)), behavior: "instant" });
        if (progress < 1) frame = requestAnimationFrame(step); else focus();
      };
      frame = requestAnimationFrame(step);
    };
    document.addEventListener("click", click);
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", key);
    return () => { cancel(); Object.assign(html.style, previous); document.removeEventListener("click", click); window.removeEventListener("wheel", cancel); window.removeEventListener("touchstart", cancel); window.removeEventListener("keydown", key); };
  }, []);
  return null;
}
