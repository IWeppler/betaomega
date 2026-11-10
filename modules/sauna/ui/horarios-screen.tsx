"use client";

import { useState, type MutableRefObject } from "react";
import { Plus, X } from "lucide-react";
import { SaveForm, usePanel, useSite } from "@/platform/panel";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { bandsOfDay, clockOptions, startsExample, turnsOverlap, type TimeBand, type TurnType } from "../domain/hours";
import type { Settings } from "../domain/setup";
import { weekdayName } from "../domain/time";
import { weekOrder, type Config } from "./config";
import { Button, Card, Field, FormArea, inputClass, Notice } from "./controls";
import { offerUndo } from "@/shared/ui/undo";
import { fetchJson, sendJson } from "./fetch-json";

const steps = [15, 30, 45, 60];

function ClockSelect({ value, label, onChange }: { value: string; label: string; onChange: (value: string) => void }) {
  // A stored time out of the half-hour steps stays selectable, so opening the screen does not change it.
  const options = clockOptions.includes(value) ? clockOptions : [...clockOptions, value].sort();
  return <Select value={value} onValueChange={onChange}>
    <SelectTrigger aria-label={label} className="tabular-nums" />
    <SelectContent>{options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
  </Select>;
}

/** One stretch of a day: from when to when, and which types of turn it offers. */
function BandRow({ band, types, day, onChange, onRemove }: { band: TimeBand; types: TurnType[]; day: string; onChange: (patch: Partial<TimeBand>) => void; onRemove: () => void }) {
  const toggle = (id: string) => onChange({ typeIds: band.typeIds.includes(id) ? band.typeIds.filter(item => item !== id) : [...band.typeIds, id] });
  return <div className="flex flex-wrap items-center gap-2">
    <span className="w-24"><ClockSelect value={band.from} label={`Empieza la franja del ${day}`} onChange={from => onChange({ from })} /></span>
    <span className="text-sm text-muted">a</span>
    <span className="w-24"><ClockSelect value={band.to} label={`Termina la franja del ${day}`} onChange={to => onChange({ to })} /></span>
    <div className="flex flex-wrap gap-1" role="group" aria-label={`Tipos de turno de la franja del ${day}`}>
      {types.map(type => {
        const on = band.typeIds.includes(type.id ?? "");
        return <button key={type.id} type="button" aria-pressed={on} onClick={() => toggle(type.id ?? "")} className={`min-h-control rounded-control border px-2.5 text-sm font-medium transition-colors duration-150 ${on ? "border-accent bg-accent-soft text-accent-text" : "border-line-strong bg-surface text-muted hover:bg-sunken"}`}>{type.name}</button>;
      })}
    </div>
    <button type="button" aria-label={`Quitar esta franja del ${day}`} onClick={onRemove} className="inline-grid size-control place-items-center rounded-control text-muted hover:bg-sunken hover:text-ink"><X size={16} aria-hidden="true" /></button>
  </div>;
}

export function WeekForm({ config, settings, onSaved, onDiscard, flushRef }: { config: Config; settings: Settings; onSaved: () => Promise<void>; onDiscard: () => void; flushRef: MutableRefObject<() => Promise<boolean>> }) {
  const site = useSite();
  const panel = usePanel();
  const [error, setError] = useState("");
  const types = config.types;
  const known = new Set(types.map(type => type.id));
  // A band keeps only the types that still exist.
  const [bands, setBands] = useState<TimeBand[]>(() => config.bands.map(band => ({ ...band, typeIds: band.typeIds.filter(id => known.has(id)) })));
  // A day switched off keeps its bands on screen, so switching it back on does not lose them until saving.
  const [closedDays, setClosedDays] = useState<number[]>(() => weekOrder.filter(day => !bandsOfDay(config.bands, day).length));
  const [step, setStep] = useState(settings.startStepMinutes);
  const newBand = (weekday: number, from = "10:00", to = "20:00"): TimeBand => ({ weekday, from, to, typeIds: types.flatMap(type => type.id ?? []) });
  const setOpen = (weekday: number, open: boolean) => {
    setClosedDays(current => (open ? current.filter(day => day !== weekday) : [...current, weekday]));
    if (open && !bandsOfDay(bands, weekday).length) setBands(current => [...current, newBand(weekday)]);
  };
  const patchBand = (target: TimeBand, patch: Partial<TimeBand>) => { setBands(current => current.map(band => (band === target ? { ...band, ...patch } : band))); };
  const removeBand = (target: TimeBand) => {
    if (bandsOfDay(bands, target.weekday).length === 1) setClosedDays(current => [...current, target.weekday]);
    setBands(current => current.filter(band => band !== target));
  };
  const addBand = (weekday: number) => {
    const last = bandsOfDay(bands, weekday).at(-1);
    const from = last?.to ?? "10:00";
    setBands(current => [...current, newBand(weekday, from, clockOptions.find(option => option > from && option >= "20:00") ?? "23:30")]);
  };
  const save = async (form: HTMLFormElement) => {
    const values = new FormData(form);
    panel.setBusy(true);
    setError("");
    try {
      await sendJson(`/api/sites/${site.id}/sauna/week`, "PUT", {
        bands: bands.filter(band => !closedDays.includes(band.weekday)), capacity: Number(values.get("capacity")), stepMinutes: step, revision: settings.revision,
      });
      await onSaved();
      // The week as it was, over the revision it has now.
      offerUndo("Se guardaron los horarios.", async () => {
        const now = await fetchJson<Config>(`/api/sites/${site.id}/sauna/config`);
        await sendJson(`/api/sites/${site.id}/sauna/week`, "PUT", {
          bands: config.bands, capacity: config.rooms.find(room => room.active)?.capacity ?? 2, stepMinutes: settings.startStepMinutes, revision: now.settings?.revision ?? settings.revision,
        });
        await onSaved();
      });
      return true;
    } catch (failure) {
      setError((failure as Error).message);
      return false;
    } finally { panel.setBusy(false); }
  };
  if (!types.length) return <Notice>Primero creá un tipo de turno</Notice>;
  return <FormArea><SaveForm onSave={save} changes={JSON.stringify({ bands, closedDays, step })} paused={panel.busy} error={error} registerRef={flushRef} onDiscard={onDiscard}>
    <div className="mb-4 grid gap-4">
      <Card className="grid gap-1">
        {weekOrder.map(weekday => {
          const day = weekdayName(weekday);
          const open = !closedDays.includes(weekday);
          return <div key={weekday} className="grid grid-cols-[6rem_1fr] items-start gap-x-3 gap-y-2 border-b border-line py-3 last:border-b-0 sm:grid-cols-[7rem_8rem_1fr]">
            <span className="flex min-h-control items-center font-medium text-ink"><span className="first-letter:uppercase">{day}</span></span>
            <label className="flex min-h-control items-center gap-2 text-muted">
              <Switch checked={open} aria-label={`Abrir el ${day}`} onCheckedChange={value => setOpen(weekday, value)} />
              {open ? "Abierto" : "Cerrado"}
            </label>
            {open && <div className="col-span-2 grid gap-2 sm:col-span-1">
              {bandsOfDay(bands, weekday).map(band => /* The position, not the hour: changing the hour must not remount the selector the person is using. */ <BandRow key={bands.indexOf(band)} band={band} types={types} day={day} onChange={patch => patchBand(band, patch)} onRemove={() => removeBand(band)} />)}
              <div><Button onClick={() => addBand(weekday)}><Plus size={15} aria-hidden="true" />Agregar franja</Button></div>
            </div>}
          </div>;
        })}
      </Card>

      <Card className="grid gap-3 sm:grid-cols-2">
        <Field label="Personas en el módulo" hint="Hasta cuántas entran en una reserva grupal. Cada reserva, individual o grupal, ocupa el módulo completo."><input className={inputClass} name="capacity" type="number" min={1} max={200} defaultValue={config.rooms.find(room => room.active)?.capacity ?? 2} required /></Field>
        <div className="grid content-start gap-1">
          <span className="font-semibold text-ink">Los turnos empiezan cada</span>
          <Select value={String(step)} onValueChange={value => { setStep(Number(value)); }}>
            <SelectTrigger aria-label="Los turnos empiezan cada" />
            <SelectContent>{[...new Set([...steps, step])].sort((a, b) => a - b).map(minutes => <SelectItem key={minutes} value={String(minutes)}>{minutes} minutos</SelectItem>)}</SelectContent>
          </Select>
          <p className="m-0 text-sm text-muted">{startsExample(types, bands.filter(band => !closedDays.includes(band.weekday)), step)}</p>
          {turnsOverlap(types, step) && <p className="m-0 text-sm text-muted">Los turnos se pisan: reservar uno bloquea los que se le superponen.</p>}
        </div>
      </Card>
    </div>
  </SaveForm></FormArea>;
}

