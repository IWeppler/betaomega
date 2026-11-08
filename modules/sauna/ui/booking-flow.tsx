"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { formatCents } from "@/platform/money";
import type { Turn } from "../domain/agenda";
import type { BookingKind } from "../domain/booking";
import { describeRules, type PolicyRule } from "../domain/policy";
import { quote, type CodeEffect } from "../domain/pricing";
import { addDays, businessDate, businessTime, dayLabel, shortDayLabel, type DateText } from "../domain/time";
import { Button, Field, inputClass, Notice } from "./controls";
import { fetchJson, sendJson } from "./fetch-json";

const DAYS_SHOWN = 7;

export type BookingFlowData = { siteId: string; today: DateText; rules: PolicyRule[]; maxAdvanceDays: number; termsHref: string; preview: boolean };

const offersShared = (turn: Turn) => turn.priceCents !== null && turn.freeSeats > 0;
const offersPrivate = (turn: Turn) => turn.privatePriceCents !== null && turn.freeSeats === turn.capacity;
const canChoose = (turn: Turn) => turn.bookable && (offersShared(turn) || offersPrivate(turn));

/** What a type costs and how much room is left, on its button. */
const optionText = (turn: Turn) => {
  if (turn.closed) return "Cerrado";
  if (!canChoose(turn)) return turn.freeSeats === 0 ? "Reservado" : "No disponible";
  return [offersShared(turn) && `Individual ${formatCents(turn.priceCents ?? 0)}`, offersPrivate(turn) && `Grupal ${formatCents(turn.privatePriceCents ?? 0)}`].filter(Boolean).join(" · ");
};

/** The look of anything picked from a set: a day, a time, a type, a modality. */
const choiceClass = (selected: boolean) => `rounded-field border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-surface text-ink enabled:hover:border-accent"}`;

const groupTitle = "m-0 mb-2 p-0 text-[13px] font-semibold text-ink";

/** What the code check answered. Only for the preview: the reservation sends the text and the server applies it again. */
type AppliedCode = CodeEffect & { code: string; description: string };

function Steps({ current }: { current: 1 | 2 }) {
  return <ol className="m-0 mb-3 flex sm:mb-4 list-none items-center gap-6 p-0 pr-10 text-xs" aria-label="Pasos de la reserva">
    {["Tu visita", "Tus datos"].map((label, index) => {
      const active = index + 1 === current;
      return <li key={label} aria-current={active ? "step" : undefined} className={`flex items-center gap-2 ${active ? "text-ink" : "text-muted"}`}>
        <span className={`grid size-5.5 place-items-center rounded-full border text-[11px] ${active ? "border-accent bg-accent text-accent-ink" : "border-line-strong"}`}>{index + 1}</span>
        {label}
      </li>;
    })}
  </ol>;
}

/** The booking request. The amounts here are a preview from what the server said about the turn: sauna_reserve computes them again and that is what counts. */
function BookingForm({ turn, data, onBack }: { turn: Turn; data: BookingFlowData; onBack: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<BookingKind>(offersShared(turn) ? "shared" : "private");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeText, setCodeText] = useState("");
  const [codeError, setCodeError] = useState("");
  const [checking, setChecking] = useState(false);
  const [applied, setApplied] = useState<AppliedCode | null>(null);
  const preview = quote(turn, kind, 1, applied);
  const form = useRef<HTMLFormElement>(null);
  const checkCode = async () => {
    if (!codeText.trim()) { setCodeError("Escribí el código."); return; }
    setChecking(true);
    setCodeError("");
    try {
      const whatsapp = form.current ? new FormData(form.current).get("whatsapp") : null;
      setApplied(await sendJson<AppliedCode>(`/api/sites/${data.siteId}/sauna/codes/check`, "POST", { code: codeText, roomId: turn.roomId, turnTypeId: turn.turnTypeId, whatsapp }));
    } catch (failure) {
      setApplied(null);
      setCodeError((failure as Error).message);
    } finally { setChecking(false); }
  };
  const removeCode = () => { setApplied(null); setCodeText(""); setCodeError(""); };
  const submit = async (form: HTMLFormElement) => {
    const values = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const { token } = await sendJson<{ token: string }>(`/api/sites/${data.siteId}/sauna/reservations`, "POST", {
        roomId: turn.roomId, turnTypeId: turn.turnTypeId, startsAt: turn.startsAt, kind, name: values.get("name"), whatsapp: values.get("whatsapp"), code: applied?.code ?? null,
        // Pressing the button is the acceptance: the notice below it says so.
        termsAccepted: true,
      });
      router.push(`/reserva/${token}`);
    } catch (failure) {
      setError((failure as Error).message);
      setBusy(false);
    }
  };
  // Sized so the whole step fits a phone's screen (about 390 × 660 with the browser's bars): the turn and its "Cambiar" share one box, the amounts one
  // row, the code and the cancellation one line, and the button with the terms stays pinned to the bottom if a long name or an open policy pushes past it.
  return <form ref={form} className="flex flex-1 flex-col gap-3 sm:grid" onSubmit={event => { event.preventDefault(); void submit(event.currentTarget); }}>
    <div className="flex items-center justify-between gap-3 rounded-field bg-surface py-2.5 pr-1.5 pl-3">
      <p className="m-0 min-w-0 text-[13px] leading-5">
        <span className="block text-ink first-letter:uppercase">{dayLabel(businessDate(turn.startsAt))}</span>
        <span className="block text-muted"><span className="tabular-nums">{businessTime(turn.startsAt)} a {businessTime(turn.endsAt)}</span>, {turn.typeName}</span>
      </p>
      <button type="button" disabled={busy} onClick={onBack} className="min-h-control shrink-0 px-2.5 text-[13px] text-accent-text hover:underline disabled:opacity-55">Cambiar</button>
    </div>

    {offersShared(turn) && offersPrivate(turn) && <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="m-0 mb-1 p-0 text-[13px] font-semibold text-ink">Modalidad</legend>
      <div className="grid grid-cols-2 gap-2">
        {([["shared", "Individual", turn.priceCents], ["private", "Grupal", turn.privatePriceCents]] as const).map(([value, label, cents]) => <label key={value} className={`${choiceClass(kind === value)} flex min-h-control cursor-pointer items-center justify-between gap-2 px-3 text-[13px] active:scale-[0.98] has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-focus`}>
          <input className="sr-only" type="radio" name="kind" checked={kind === value} onChange={() => setKind(value)} />
          <span>{label}</span>
          <span className="tabular-nums">{formatCents(cents ?? 0)}</span>
        </label>)}
      </div>
    </fieldset>}

    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Tu nombre" className="text-[13px]"><input className={inputClass} name="name" autoComplete="name" maxLength={80} placeholder="¿Cómo te llamás?" required /></Field>
      <Field label="WhatsApp" className="text-[13px]">
        <span className="flex min-h-control items-stretch rounded-field border border-line-strong bg-surface focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-focus">
          <span className="flex items-center border-r border-line-strong px-3 text-[15px] font-normal text-muted tabular-nums" aria-hidden="true">+54</span>
          <input className="w-full min-w-0 border-0 bg-transparent px-3 text-[15px] font-normal text-ink outline-none" name="whatsapp" type="tel" autoComplete="tel-national" aria-label="WhatsApp, con el +54 ya puesto" placeholder="11 2345 6789" required />
        </span>
      </Field>
    </div>

    {applied
      ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-field bg-surface px-3 py-2 text-[13px]" role="status">
        <span><span className="font-semibold text-ink">{applied.code}</span> <span className="text-muted">· {applied.description}</span></span>
        <button type="button" disabled={busy} onClick={removeCode} className="min-h-control px-2 text-accent-text hover:underline disabled:opacity-55">Quitar</button>
      </div>
      : codeOpen
        ? <div className="grid gap-1">
          <label htmlFor="booking-code" className="text-[13px] font-semibold text-ink">Código</label>
          <div className="flex gap-2">
            <input id="booking-code" className={`${inputClass} uppercase`} value={codeText} maxLength={40} autoComplete="off" autoCapitalize="characters" spellCheck={false}
              onChange={event => setCodeText(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void checkCode(); } }}
              aria-invalid={codeError ? true : undefined} aria-describedby={codeError ? "booking-code-error" : undefined} />
            <Button disabled={checking || busy} onClick={() => void checkCode()}>{checking ? "Revisando…" : "Aplicar"}</Button>
          </div>
          {codeError && <p id="booking-code-error" role="alert" className="m-0 text-[13px] text-danger">{codeError}</p>}
        </div>
        : null}

    {/* The code's link and the cancellation share a line; each opens below it. */}
    {(!applied && !codeOpen) || data.rules.length > 0 ? <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-[13px]">
      {!applied && !codeOpen && <button type="button" onClick={() => setCodeOpen(true)} className="min-h-8 px-0 text-accent-text hover:underline">¿Tenés un código?</button>}
      {data.rules.length > 0 && <details className="group ml-auto open:basis-full">
        <summary className="flex min-h-8 cursor-pointer list-none items-center justify-end text-muted underline-offset-4 hover:text-ink hover:underline [&::-webkit-details-marker]:hidden">Si necesitás cancelar</summary>
        <ul className="m-0 mt-1 grid list-disc gap-1 pl-5 text-left text-muted">{describeRules(data.rules).map(line => <li key={line}>{line}</li>)}</ul>
      </details>}
    </div> : null}

    {/* One row instead of four: what it costs, what is paid now, what is left for the visit. */}
    <dl className="m-0 grid grid-cols-3 border-y border-line-strong py-2.5 text-[13px]">
      <div><dt className="text-[11px] text-muted">Precio</dt><dd className="m-0 tabular-nums">{formatCents(preview.totalCents)}</dd></div>
      <div className="border-x border-line-strong px-3"><dt className="text-[11px] text-muted">Seña ahora</dt><dd className="m-0 font-semibold text-accent-text tabular-nums">{formatCents(preview.depositCents)}</dd></div>
      <div className="pl-3"><dt className="text-[11px] text-muted">En el lugar</dt><dd className="m-0 tabular-nums">{formatCents(preview.balanceCents)}</dd></div>
    </dl>
    {preview.discountCents > 0 && <p className="m-0 text-xs text-muted">El precio ya tiene el descuento de {formatCents(preview.discountCents)}.</p>}
    {applied && preview.confirmsAtOnce && <p className="m-0 text-[13px] text-muted">Con este código no pagás seña: la reserva queda confirmada al instante.</p>}

    {error && <Notice kind="error">{error}</Notice>}
    {data.preview && <Notice>Es una vista previa: desde acá no se toman reservas.</Notice>}
    <div className="sticky bottom-0 -mx-5 mt-auto grid gap-1.5 border-t border-line bg-bg px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:p-0">
      <button type="submit" disabled={busy || data.preview} className="flex min-h-control w-full items-center justify-between rounded-control bg-accent px-4 py-3.5 text-sm text-accent-ink transition-[background-color,transform] duration-150 enabled:hover:bg-accent-hover enabled:active:scale-[0.98] disabled:opacity-55">
        {busy ? "Reservando…" : "Reservar"}<ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <p className="m-0 text-center text-xs text-muted">Al reservar aceptás los <a className="text-accent-text underline underline-offset-2" href={data.termsHref} target="_blank" rel="noopener">términos</a> y declarás tener 18 años o más.</p>
    </div>
  </form>;
}

export function BookingFlow({ data }: { data: BookingFlowData }) {
  const lastDay = addDays(data.today, data.maxAdvanceDays);
  const [first, setFirst] = useState(data.today);
  const [day, setDay] = useState(data.today);
  const [result, setResult] = useState<{ from: DateText; turns: Turn[] } | null>(null);
  const [error, setError] = useState("");
  const [hour, setHour] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Turn | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const load = useCallback(async () => {
    setError("");
    try {
      const turns = await fetchJson<Turn[]>(`/api/sites/${data.siteId}/sauna/availability?from=${first}&to=${addDays(first, DAYS_SHOWN - 1)}`);
      setResult({ from: first, turns });
    } catch (failure) { setError((failure as Error).message); }
  }, [data.siteId, first]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  // Each step replaces the content: whoever uses a screen reader or a keyboard has to land on its title.
  useEffect(() => { heading.current?.focus(); }, [chosen]);

  const title = <>
    <Steps current={chosen ? 2 : 1} />
    {/* Focused from code, only to place the reader: it is not a control, so no ring. */}
    <h2 id="booking-title" ref={heading} tabIndex={-1} className="m-0 mb-3 font-display text-2xl/snug font-normal text-ink outline-none">{chosen ? "Completá tu reserva" : "Reservá tu momento"}</h2>
  </>;

  if (chosen) return <>{title}<BookingForm turn={chosen} data={data} onBack={() => { setChosen(null); setHour(null); void load(); }} /></>;

  const dates = Array.from({ length: DAYS_SHOWN }, (_, index) => addDays(first, index));
  const loaded = result?.from === first;
  const turnsOf = (date: DateText) => loaded ? result.turns.filter(turn => businessDate(turn.startsAt) === date) : [];
  const startsOf = (date: DateText) => [...turnsOf(date).reduce((all, turn) => all.set(turn.startsAt, [...(all.get(turn.startsAt) ?? []), turn]), new Map<string, Turn[]>())];
  const starts = startsOf(day);
  const options = starts.find(([startsAt]) => startsAt === hour)?.[1] ?? [];
  const openDay = (date: DateText) => { setDay(date); setHour(null); };
  const page = (start: DateText) => { setFirst(start); openDay(start); };
  // With a single type there is nothing to compare: the time goes straight to the form.
  const pickHour = (startsAt: string, available: Turn[]) => { if (available.length === 1) setChosen(available[0]); else setHour(startsAt); };
  const arrow = "grid size-control place-items-center rounded-full border border-line-strong text-ink transition-colors duration-150 enabled:hover:bg-surface disabled:opacity-40";
  return <>
    {title}
    <div className="grid content-start gap-4 pb-6 sm:pb-0">
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className={`${groupTitle} mb-0 font-text`}>¿Qué día querés venir?</h3>
          <div className="flex gap-1.5">
            <button type="button" aria-label="Días anteriores" className={arrow} disabled={first <= data.today} onClick={() => page(addDays(first, -DAYS_SHOWN) < data.today ? data.today : addDays(first, -DAYS_SHOWN))}><ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" /></button>
            <button type="button" aria-label="Días siguientes" className={arrow} disabled={addDays(first, DAYS_SHOWN) > lastDay} onClick={() => page(addDays(first, DAYS_SHOWN))}><ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" /></button>
          </div>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:thin]" role="group" aria-label="Elegí un día">
          {dates.map(date => {
            const open = startsOf(date).filter(([, available]) => available.some(canChoose)).length;
            return <button key={date} type="button" aria-pressed={date === day} disabled={date > lastDay} onClick={() => openDay(date)} className={`${choiceClass(date === day)} grid min-w-14 flex-1 justify-items-center gap-0.5 px-0.5 py-2.5`}>
              <span className="font-display text-2xl/none">{Number(date.slice(8))}</span>
              <span className="text-[11px] first-letter:uppercase">{shortDayLabel(date).split(" ")[0]}</span>
              <span className={`text-[10px] ${date === day ? "" : "text-muted"}`}>{!loaded ? " " : open === 0 ? "Sin turnos" : `${open} ${open === 1 ? "turno" : "turnos"}`}</span>
            </button>;
          })}
        </div>
      </div>

      <div className="min-w-0">
        <h3 className={`${groupTitle} font-text first-letter:uppercase`}>{dayLabel(day)}</h3>
        {error && <div className="grid justify-items-start gap-2"><Notice kind="error">{error}</Notice><Button onClick={() => void load()}>Reintentar</Button></div>}
        {!loaded && !error && <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5" aria-busy="true" aria-label="Buscando turnos">{Array.from({ length: 5 }, (_, index) => <span key={index} className="min-h-control animate-pulse rounded-field bg-surface" />)}</div>}
        {loaded && starts.length === 0 && <p className="m-0 text-sm text-muted">Este día no hay turnos. Probá con otro.</p>}
        {starts.length > 0 && <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5" role="group" aria-label="Elegí un horario">
          {starts.map(([startsAt, available]) => {
            const open = available.filter(canChoose);
            return <button key={startsAt} type="button" className={`${choiceClass(hour === startsAt)} min-h-control px-1 text-[13px] tabular-nums`} aria-pressed={hour === startsAt} disabled={!open.length} onClick={() => pickHour(startsAt, open)}>{businessTime(startsAt)}</button>;
          })}
        </div>}
        {loaded && starts.length > 0 && !starts.some(([, available]) => available.some(canChoose)) && <p className="m-0 mt-2 text-sm text-muted">{starts[0][1][0].closed ? "Este día está cerrado." : "No quedan turnos este día. Probá con otro."}</p>}
      </div>

      {options.length > 0 && <div className="grid gap-2 sm:grid-cols-2">
        {options.map(turn => <button key={turn.turnTypeId} type="button" className={`${choiceClass(false)} grid min-h-control justify-items-start px-3 py-2.5 text-left`} disabled={!canChoose(turn)} onClick={() => setChosen(turn)}>
          <span className="text-[13px]">{turn.typeName}</span>
          <span className="text-xs text-muted">{optionText(turn)}</span>
        </button>)}
      </div>}

      <p className="m-0 text-xs text-muted">Vas a ver el precio y la seña antes de confirmar.</p>
    </div>
  </>;
}
