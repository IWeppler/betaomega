"use client";

import { useEffect } from "react";

/**
 * The page's scroll. The mouse wheel and the trackpad move a target and the page eases toward it, so it glides instead of stepping; touch, the keyboard, the scrollbar and anything
 * that scrolls on its own (the phone menu, a map) keep their native behavior. Section links glide to their section. Reduced motion turns all of it off.
 */
export function SiteMotion() {
  useEffect(() => {
    const html = document.documentElement;
    const theme = document.querySelector<HTMLElement>('[data-theme="sauna"]');
    const previous = { colorScheme: html.style.colorScheme, scrollbarColor: html.style.scrollbarColor };
    if (theme) {
      const tokens = getComputedStyle(theme);
      html.style.colorScheme = "light";
      html.style.scrollbarColor = `${tokens.getPropertyValue("--color-line-strong").trim()} ${tokens.getPropertyValue("--color-bg").trim()}`;
    }
    let frame = 0;
    let smoothFrame = 0;
    let smoothing = false;
    let goal = 0;
    let position = 0;
    let stamp = 0;
    const cancel = () => { cancelAnimationFrame(frame); cancelAnimationFrame(smoothFrame); smoothing = false; };
    const key = (event: KeyboardEvent) => { if (["Escape", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) cancel(); };
    const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
    // One glide for every in-page jump: a quartic ease in and out (it leaves and lands softly, with a firm middle) whose time grows with the square root of the distance, so a short hop is quick and a long one is still calm.
    const glide = (end: number, done?: () => void) => {
      cancel();
      const start = window.scrollY;
      if (reduced() || Math.abs(end - start) < 2) { window.scrollTo({ top: end, behavior: "instant" }); done?.(); return; }
      const duration = Math.min(1400, 650 + Math.sqrt(Math.abs(end - start)) * 18);
      const began = performance.now();
      const ease = (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);
      const step = (now: number) => {
        const progress = Math.min((now - began) / duration, 1);
        window.scrollTo({ top: start + (end - start) * ease(progress), behavior: "instant" });
        if (progress < 1) frame = requestAnimationFrame(step); else done?.();
      };
      frame = requestAnimationFrame(step);
    };
    // Something inside the page that can still scroll in that direction (a menu, a list) keeps the wheel.
    const scrollsInside = (from: Element, dy: number) => {
      for (let el: Element | null = from; el && el !== document.body && el !== html; el = el.parentElement) {
        if (!/(auto|scroll)/.test(getComputedStyle(el).overflowY) || el.scrollHeight <= el.clientHeight + 1) continue;
        if (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
      }
      return false;
    };
    const tick = (now: number) => {
      const dt = Math.min(now - stamp, 50);
      stamp = now;
      // Frame-rate independent: the page closes about 60% of the gap every 100 ms, whatever the screen's refresh rate.
      position += (goal - position) * (1 - Math.exp(-dt / 110));
      const arrived = Math.abs(goal - position) < 0.4;
      window.scrollTo({ top: arrived ? goal : position, behavior: "instant" });
      if (arrived) { smoothing = false; return; }
      smoothFrame = requestAnimationFrame(tick);
    };
    const wheel = (event: WheelEvent) => {
      cancelAnimationFrame(frame);
      if (event.defaultPrevented || event.ctrlKey || reduced() || html.style.overflow === "hidden" || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !(event.target instanceof Element) || scrollsInside(event.target, event.deltaY)) return;
      event.preventDefault();
      if (!smoothing) { position = window.scrollY; goal = position; smoothing = true; stamp = performance.now(); smoothFrame = requestAnimationFrame(tick); }
      const unit = event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? innerHeight : 1;
      goal = Math.max(0, Math.min(goal + event.deltaY * unit, html.scrollHeight - innerHeight));
    };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('[data-theme="sauna"] a[href]');
      if (!link || link.target || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) return;
      // The brand on the page it points to: back to the top, softly, instead of an instant jump.
      if (!url.hash) { event.preventDefault(); glide(0); return; }
      let target: HTMLElement | null;
      try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch { return; }
      if (!target) return;
      event.preventDefault();
      if (location.hash !== url.hash) history.pushState(history.state, "", url.hash);
      const start = window.scrollY;
      // The section's own scroll margin keeps its title off the edge; going up, the header comes back and covers the top, so its height is added.
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      let end = start + target.getBoundingClientRect().top - Math.max(margin, 16);
      if (end < start) end -= document.querySelector<HTMLElement>('[data-theme="sauna"] header')?.offsetHeight ?? 0;
      end = Math.max(0, Math.min(end, document.documentElement.scrollHeight - innerHeight));
      glide(end, () => {
        if (event.detail !== 0 || !target) return;
        const hadIndex = target.hasAttribute("tabindex");
        if (!hadIndex) { target.tabIndex = -1; target.addEventListener("blur", () => target?.removeAttribute("tabindex"), { once: true }); }
        target.focus({ preventScroll: true });
      });
    };
    document.addEventListener("click", click);
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("pointerdown", cancel, { passive: true });
    window.addEventListener("keydown", key);
    return () => { cancel(); Object.assign(html.style, previous); document.removeEventListener("click", click); window.removeEventListener("wheel", wheel); window.removeEventListener("touchstart", cancel); window.removeEventListener("pointerdown", cancel); window.removeEventListener("keydown", key); };
  }, []);
  return null;
}
