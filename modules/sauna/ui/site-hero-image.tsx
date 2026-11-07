"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import landscape from "../../../public/fropexio-paisaje.jpg";

export function HeroImage() {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const draw = () => {
      frame = 0;
      if (layer.current) layer.current.style.transform = media.matches ? "none" : `translate3d(0,${Math.min(Math.max(window.scrollY, 0) * 0.1, 80)}px,0) scale(1.04)`;
    };
    const refresh = () => { if (!frame) frame = requestAnimationFrame(draw); };
    draw(); window.addEventListener("scroll", refresh, { passive: true }); media.addEventListener("change", refresh);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", refresh); media.removeEventListener("change", refresh); };
  }, []);
  return <div ref={layer} className="absolute inset-0 origin-top [backface-visibility:hidden]">
    <Image src={landscape} alt="" fill preload placeholder="blur" sizes="100vw" className="object-cover object-[65%_center] md:object-center" />
  </div>;
}
