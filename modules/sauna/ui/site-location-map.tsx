"use client";

import { MapPin } from "lucide-react";
import type { MapLocation } from "../domain/map-location";
import { Map, MapControls, MapMarker } from "./map";

export default function SiteLocationMap({ location, address, mapUrl }: { location: MapLocation; address: string; mapUrl: string }) {
  const center: [number, number] = [location.longitude, location.latitude];
  return <Map center={center}>
    <MapMarker longitude={location.longitude} latitude={location.latitude}>
      <a href={mapUrl} target="_blank" rel="noopener noreferrer" aria-label={`Cómo llegar a Fropexio: ${address}`} className="mb-2 flex flex-col items-center gap-2 text-accent-text no-underline">
        <span className="rounded-control border border-line-strong bg-bg px-3 py-2 text-sm font-semibold text-ink shadow-lift">Fropexio</span>
        <span className="grid size-11 place-items-center rounded-full border border-accent bg-bg text-accent-text shadow-lift"><MapPin size={22} aria-hidden="true" /></span>
      </a>
    </MapMarker>
    <MapControls center={center} />
  </Map>;
}
