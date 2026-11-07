"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { MapLocation } from "../domain/map-location";

const LocationMap = dynamic(() => import("./site-location-map"), { ssr: false, loading: () => <p role="status" className="m-0 grid h-full place-items-center text-sm text-muted">Preparando el mapa…</p> });

export function SiteLocation({ location, address, mapUrl }: { location: MapLocation; address: string; mapUrl: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: "300px" });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={container} className="h-96 w-full overflow-hidden rounded-card border border-line-strong bg-sunken md:h-112">
    {visible ? <LocationMap location={location} address={address} mapUrl={mapUrl} /> : <p className="m-0 grid h-full place-items-center text-sm text-muted">Ubicación de Fropexio</p>}
  </div>;
}
