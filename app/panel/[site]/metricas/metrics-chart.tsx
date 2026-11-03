"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { compactNumber, niceScale, type DayRow } from "@/lib/metrics";

const height = 240;
const margin = { top: 14, right: 18, bottom: 30, left: 44 };
const series = [
  { key: "pageViews", label: "Visitas al sitio", className: "s1" },
  { key: "recipeViews", label: "Vistas de recetas", className: "s2" },
] as const;

const dayText = (day: string, long = false) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("es-AR", { day: "numeric", month: long ? "long" : "short", timeZone: "UTC" });
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("es-AR")} ${n === 1 ? one : many}`;

/** Visits and recipe views per day: two lines on one axis, a crosshair with a tooltip, arrow keys, and a table as the alternative. */
export function MetricsChart({ rows }: { rows: DayRow[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, [asTable]);

  const n = rows.length;
  const innerW = width - margin.left - margin.right, innerH = height - margin.top - margin.bottom;
  const scale = niceScale(Math.max(0, ...rows.flatMap(r => [r.pageViews, r.recipeViews])));
  const x = (i: number) => margin.left + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
  const y = (v: number) => margin.top + innerH - (v / scale.max) * innerH;
  const line = (key: "pageViews" | "recipeViews") => rows.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`).join(" ");
  const area = `${line("pageViews")} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const step = Math.max(1, Math.ceil(n / 6));
  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const left = event.currentTarget.getBoundingClientRect().left;
    setHover(Math.min(n - 1, Math.max(0, Math.round(((event.clientX - left - margin.left) / innerW) * (n - 1)))));
  };
  const keys = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      setHover(current => Math.min(n - 1, Math.max(0, (current ?? n - 1) + (event.key === "ArrowRight" ? 1 : -1))));
    } else if (event.key === "Escape") setHover(null);
  };
  const shown = hover === null ? null : rows[hover];
  const total = (key: "pageViews" | "recipeViews") => rows.reduce((sum, r) => sum + r[key], 0);
  // Without a hover the end dots mark the latest day.
  const dotAt = hover ?? n - 1;

  return <figure className="metrics-chart">
    <figcaption>
      <ul className="metrics-legend" aria-label="Series">
        {series.map(s => <li key={s.key}><span className={`metrics-key ${s.className}`} aria-hidden="true" />{s.label}</li>)}
      </ul>
      <button type="button" className="button" onClick={() => { setAsTable(!asTable); setHover(null); }}>{asTable ? "Ver como gráfico" : "Ver como tabla"}</button>
    </figcaption>
    {asTable
      ? <div className="metrics-table-wrap" tabIndex={0} role="region" aria-label="Visitas por día, en tabla">
        <table className="panel-table">
          <thead><tr><th scope="col">Día</th><th scope="col" className="is-num">Visitas al sitio</th><th scope="col" className="is-num">Vistas de recetas</th><th scope="col" className="is-num">Compartidos</th></tr></thead>
          <tbody>{[...rows].reverse().map(r => <tr key={r.day}><th scope="row">{dayText(r.day, true)}</th><td className="is-num">{r.pageViews}</td><td className="is-num">{r.recipeViews}</td><td className="is-num">{r.shares}</td></tr>)}</tbody>
        </table>
      </div>
      : <div className="metrics-plot" ref={box} tabIndex={0} onKeyDown={keys} onBlur={() => setHover(null)}
        role="group" aria-label={`Visitas por día: ${plural(total("pageViews"), "visita", "visitas")} y ${plural(total("recipeViews"), "vista de receta", "vistas de recetas")} en ${n} días. Con las flechas recorrés los días.`}>
        <svg width={width} height={height} onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)} aria-hidden="true">
          {scale.ticks.map(t => <g key={t}>
            <line className="metrics-grid" x1={margin.left} x2={width - margin.right} y1={y(t)} y2={y(t)} />
            <text className="metrics-axis" x={margin.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">{compactNumber(t)}</text>
          </g>)}
          {rows.map((r, i) => (n - 1 - i) % step === 0 && <text key={r.day} className="metrics-axis" x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{dayText(r.day)}</text>)}
          <path className="metrics-area s1" d={area} />
          <path className="metrics-line s1" d={line("pageViews")} />
          <path className="metrics-line s2" d={line("recipeViews")} />
          {hover !== null && <line className="metrics-cross" x1={x(hover)} x2={x(hover)} y1={margin.top} y2={margin.top + innerH} />}
          {series.map(s => <circle key={s.key} className={`metrics-dot ${s.className}`} cx={x(dotAt)} cy={y(rows[dotAt][s.key])} r={4} />)}
        </svg>
        {shown && <div className="metrics-tip" role="status" style={{ left: Math.min(x(dotAt) + 12, width - 190), top: margin.top }}>
          <strong>{dayText(shown.day, true)}</strong>
          {series.map(s => <span key={s.key}><span className={`metrics-key ${s.className}`} aria-hidden="true" />{s.label}<b>{shown[s.key].toLocaleString("es-AR")}</b></span>)}
        </div>}
      </div>}
  </figure>;
}
