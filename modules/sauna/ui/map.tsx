"use client";

// Adapted from mapcn (https://www.mapcn.dev/r/map.json), MIT, copyright 2025 Anmoldeep Singh.
// Only the map, marker and zoom controls are retained. See map.LICENSE.
import type * as MapLibre from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LocateFixed, Minus, Plus } from "lucide-react";

type MapLibrary = typeof MapLibre;
const MapContext = createContext<{ map: MapLibre.Map; lib: MapLibrary } | null>(null);
function useMap() {
  const context = useContext(MapContext);
  if (!context) throw new Error("Map components must be inside Map");
  return context;
}
const duration = () => matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 250;

export function Map({ center, children }: { center: [number, number]; children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const [context, setContext] = useState<{ map: MapLibre.Map; lib: MapLibrary } | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [longitude, latitude] = center;
  useEffect(() => {
    let cancelled = false;
    let instance: MapLibre.Map | undefined;
    let observer: ResizeObserver | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    import("maplibre-gl").then(lib => {
      if (cancelled || !container.current) return;
      if (!lib.getWorkerUrl()) lib.setWorkerUrl(`https://unpkg.com/maplibre-gl@${lib.getVersion()}/dist/maplibre-gl-worker.mjs`);
      instance = new lib.Map({
        container: container.current, center: [longitude, latitude], zoom: 15,
        style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
        attributionControl: { compact: false }, renderWorldCopies: false,
        scrollZoom: false, cooperativeGestures: true, pitchWithRotate: false, dragRotate: false,
        canvasContextAttributes: { antialias: false },
      });
      const map = instance;
      timer = setTimeout(() => { if (!cancelled && !map.loaded()) setFailed(true); }, 15000);
      map.on("load", () => { if (!cancelled) { clearTimeout(timer); setReady(true); setFailed(false); } });
      map.on("error", () => { if (!cancelled && !map.isStyleLoaded()) setFailed(true); });
      map.getCanvas().setAttribute("aria-label", "Mapa de ubicación de Fropexio. Usá los botones para acercar o alejar.");
      observer = new ResizeObserver(() => map.resize()); observer.observe(container.current);
      setContext({ map, lib });
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; clearTimeout(timer); observer?.disconnect(); instance?.remove(); };
  }, [longitude, latitude]);
  return <div className="relative h-full w-full overflow-hidden bg-sunken" role="region" aria-label="Ubicación en el mapa">
    <div ref={container} className="h-full w-full" />
    {context && <MapContext.Provider value={context}>{children}</MapContext.Provider>}
    {!ready && !failed && <p role="status" className="pointer-events-none absolute inset-0 m-0 grid place-items-center bg-sunken/80 text-sm text-muted">Cargando el mapa…</p>}
    {failed && <p role="status" className="absolute inset-0 m-0 grid place-items-center bg-sunken px-8 text-center text-sm text-muted">No se pudo cargar el mapa. Podés usar el enlace de indicaciones.</p>}
  </div>;
}

export function MapMarker({ longitude, latitude, children }: { longitude: number; latitude: number; children: ReactNode }) {
  const { map, lib } = useMap();
  const [element] = useState(() => document.createElement("div"));
  useEffect(() => {
    const marker = new lib.Marker({ element, anchor: "bottom" }).setLngLat([longitude, latitude]).addTo(map);
    return () => { marker.remove(); };
  }, [element, latitude, longitude, map, lib]);
  return createPortal(children, element);
}

export function MapControls({ center }: { center: [number, number] }) {
  const { map } = useMap();
  const control = "grid size-control place-items-center bg-surface text-ink transition-colors hover:bg-accent-soft hover:text-accent-text motion-reduce:transition-none";
  return <div className="absolute top-4 right-4 z-10 grid overflow-hidden rounded-control border border-line-strong shadow-card" role="group" aria-label="Controles del mapa">
    <button type="button" className={control} aria-label="Acercar mapa" onClick={() => map.zoomIn({ duration: duration() })}><Plus size={18} aria-hidden="true" /></button>
    <button type="button" className={control} aria-label="Alejar mapa" onClick={() => map.zoomOut({ duration: duration() })}><Minus size={18} aria-hidden="true" /></button>
    <button type="button" className={control} aria-label="Volver a Fropexio en el mapa" onClick={() => map.easeTo({ center, zoom: 15, duration: duration() })}><LocateFixed size={18} aria-hidden="true" /></button>
  </div>;
}
