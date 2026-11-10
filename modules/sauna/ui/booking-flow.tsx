"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Layers, TicketPercent, X } from "lucide-react";
import { formatCents } from "@/platform/money";
import type { Turn } from "../domain/agenda";
import type { BookingKind } from "../domain/booking";
import { fitsPlan, planProblem, planQuote, planSummary, type Plan } from "../domain/plans";
import { describeRules, type PolicyRule } from "../domain/policy";
import { quote, type CodeEffect } from "../domain/pricing";
import { planRejectionMessages } from "../domain/rejections";
import { addDays, businessDate, businessTime, dayLabel, shortDayLabel, type DateText } from "../domain/time";
import { Button, Field, inputClass, Notice } from "./controls";
import { fetchJson, sendJson } from "./fetch-json";

const DAYS_SHOWN = 7;

export type PublicPlan = Pick<Plan, "id" | "name" | "description" | "turns" | "priceCents" | "windowDays" | "durationMinutes" | "allowsCodes">;

export type BookingFlowData = {
  siteId: string;
  today: DateText;
  /** The first day that can be booked: today, or the opening day if it has not come yet. */
  firstDay: DateText;
  rules: PolicyRule[];
  maxAdvanceDays: number;
  termsHref: string;
  preview: boolean;
  plans: PublicPlan[];
  depositPercent: number;
};

const offersShared = (turn: Turn) => turn.priceCents !== null && turn.freeSeats > 0;
const offersPrivate = (turn: Turn) => turn.privatePriceCents !== null && turn.freeSeats === turn.capacity;
const canChoose = (turn: Turn) => turn.bookable && (offersShared(turn) || offersPrivate(turn));
/** A plan books one person in each turn, so its turns must offer the individual modality. */
const canChooseForPlan = (turn: Turn) => turn.bookable && offersShared(turn);

/** What a type costs and how much room is left, on its button. */
const optionText = (turn: Turn, forPlan: boolean) => {
  if (turn.closed) return "Cerrado";
  if (!(forPlan ? canChooseForPlan(turn) : canChoose(turn))) return turn.freeSeats === 0 ? "Reservado" : "No disponible";
  if (forPlan) return "Incluido en el plan";
  return [offersShared(turn) && `Individual ${formatCents(turn.priceCents ?? 0)}`, offersPrivate(turn) && `Grupal ${formatCents(turn.privatePriceCents ?? 0)}`].filter(Boolean).join(" · ");
};

/** The look of anything picked from a set: a day, a time, a type, a modality. */
const choiceClass = (selected: boolean) => `rounded-field border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-surface text-ink enabled:hover:border-accent"}`;

const groupTitle = "m-0 mb-2 p-0 text-[13px] font-semibold text-ink";

/** What the code check answered. Only for the preview: the reservation sends the text and the server applies it again. */
type AppliedCode = CodeEffect & { code: string; description: string };

function Steps({ current }: { current: 1 | 2 }) {
  return <ol className="m-0 mb-3 flex list-none items-center gap-6 p-0 pr-10 text-xs sm:mb-4" aria-label="Pasos de la reserva">
    {["Tu visita", "Tus datos"].map((label, index) => {
      const active = index + 1 === current;
      return <li key={label} aria-current={active ? "step" : undefined} className={`flex items-center gap-2 ${active ? "text-ink" : "text-muted"}`}>
        <span className={`grid size-5.5 place-items-center rounded-full border text-[11px] ${active ? "border-accent bg-accent text-accent-ink" : "border-line-strong"}`}>{index + 1}</span>
        {label}
      </li>;
    })}
  </ol>;
}

/** Name and WhatsApp, the same in both forms. */
function PersonFields() {
  return <div className="grid gap-3 sm:grid-cols-2">
    <Field label="Tu nombre" className="text-[13px]"><input className={inputClass} name="name" autoComplete="name" maxLength={80} placeholder="¿Cómo te llamás?" required /></Field>
    <Field label="WhatsApp" className="text-[13px]">
      <span className="flex min-h-control items-stretch rounded-field border border-line-strong bg-surface focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-focus">
        <span className="flex items-center border-r border-line-strong px-3 text-[15px] font-normal text-muted tabular-nums" aria-hidden="true">+54</span>
        <input className="w-full min-w-0 border-0 bg-transparent px-3 text-[15px] font-normal text-ink outline-none" name="whatsapp" type="tel" autoComplete="tel-national" aria-label="WhatsApp, con el +54 ya puesto" placeholder="11 2345 6789" required />
      </span>
    </Field>
  </div>;
}

/** One row instead of four: what it costs, what is paid now, what is left for the visit. */
function Amounts({ totalCents, depositCents, balanceCents, totalLabel = "Precio" }: { totalCents: number; depositCents: number; balanceCents: number; totalLabel?: string }) {
  return <dl className="m-0 grid grid-cols-3 border-y border-line-strong py-2.5 text-[13px]">
    <div><dt className="text-[11px] text-muted">{totalLabel}</dt><dd className="m-0 tabular-nums">{formatCents(totalCents)}</dd></div>
    <div className="border-x border-line-strong px-3"><dt className="text-[11px] text-muted">Seña ahora</dt><dd className="m-0 font-semibold text-accent-text tabular-nums">{formatCents(depositCents)}</dd></div>
    <div className="pl-3"><dt className="text-[11px] text-muted">En el lugar</dt><dd className="m-0 tabular-nums">{formatCents(balanceCents)}</dd></div>
  </dl>;
}

function Cancellation({ rules }: { rules: PolicyRule[] }) {
  if (!rules.length) return null;
  return <details className="group text-[13px]">
    <summary className="flex min-h-8 cursor-pointer list-none items-center text-muted underline-offset-4 hover:text-ink hover:underline [&::-webkit-details-marker]:hidden">Si necesitás cancelar</summary>
    <ul className="m-0 mt-1 grid list-disc gap-1 pl-5 text-left text-muted">{describeRules(rules).map(line => <li key={line}>{line}</li>)}</ul>
  </details>;
}

/** The button with the terms, pinned to the bottom on a phone. */
function SubmitBar({ busy, disabled, label, busyLabel, termsHref }: { busy: boolean; disabled: boolean; label: string; busyLabel: string; termsHref: string }) {
  return <div className="sticky bottom-0 -mx-5 mt-auto grid gap-1.5 border-t border-line bg-bg px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:p-0">
    <button type="submit" disabled={disabled} className="flex min-h-control w-full items-center justify-between rounded-control bg-accent px-4 py-3.5 text-sm text-accent-ink transition-[background-color,transform] duration-150 enabled:hover:bg-accent-hover enabled:active:scale-[0.98] disabled:opacity-55">
      {busy ? busyLabel : label}<ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true" />
    </button>
    <p className="m-0 text-center text-xs text-muted">Al reservar aceptás los <a className="text-accent-text underline underline-offset-2" href={termsHref} target="_blank" rel="noopener">términos</a> y declarás tener 18 años o más.</p>
  </div>;
}

/** A turn and its "Cambiar" in one box. */
function TurnBox({ turn, action }: { turn: Turn; action?: ReactNode }) {
  return <div className="flex items-center justify-between gap-3 rounded-field bg-surface py-2.5 pr-1.5 pl-3">
    <p className="m-0 min-w-0 text-[13px] leading-5">
      <span className="block text-ink first-letter:uppercase">{dayLabel(businessDate(turn.startsAt))}</span>
      <span className="block text-muted"><span className="tabular-nums">{businessTime(turn.startsAt)} a {businessTime(turn.endsAt)}</span>, {turn.typeName}</span>
    </p>
    {action}
  </div>;
}

/**
 * The discount code, always in sight: a framed box with its icon, the field and the button, instead of a small link that had to be found first.
 * Once applied, the same box says so in the accent and offers to remove it.
 */
function CodeBox({ applied, busy, onApply, onRemove }: { applied: AppliedCode | null; busy: boolean; onApply: (text: string) => Promise<string | null>; onRemove: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const apply = async () => {
    if (!text.trim()) { setError("Escribí el código."); return; }
    setChecking(true);
    setError((await onApply(text)) ?? "");
    setChecking(false);
  };
  if (applied) return <div className="flex items-center gap-3 rounded-field border border-accent bg-accent-soft px-3 py-2.5 text-[13px]" role="status">
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-ink" aria-hidden="true"><Check size={16} strokeWidth={2.5} /></span>
    <span className="min-w-0 flex-1"><span className="block font-semibold text-ink">Código {applied.code} aplicado</span><span className="block text-muted">{applied.description}</span></span>
    <button type="button" disabled={busy} onClick={() => { setText(""); onRemove(); }} className="min-h-control shrink-0 px-2 text-accent-text hover:underline disabled:opacity-55">Quitar</button>
  </div>;
  return <div className="grid gap-2 rounded-field border border-dashed border-accent bg-surface p-3">
    <label htmlFor="booking-code" className="flex items-center gap-2 text-[13px] font-semibold text-ink">
      <TicketPercent size={18} className="shrink-0 text-accent-text" aria-hidden="true" />
      ¿Tenés un código de descuento?
    </label>
    <div className="flex gap-2">
      <input id="booking-code" className={`${inputClass} uppercase placeholder:normal-case`} value={text} maxLength={40} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="Escribilo acá"
        onChange={event => setText(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void apply(); } }}
        aria-invalid={error ? true : undefined} aria-describedby={error ? "booking-code-error" : undefined} />
      <Button disabled={checking || busy} onClick={() => void apply()}>{checking ? "Revisando…" : "Aplicar"}</Button>
    </div>
    {error && <p id="booking-code-error" role="alert" className="m-0 text-[13px] text-danger">{error}</p>}
  </div>;
}

/** The booking request. The amounts here are a preview from what the server said about the turn: sauna_reserve computes them again and that is what counts. */
function BookingForm({ turn, data, onBack }: { turn: Turn; data: BookingFlowData; onBack: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<BookingKind>(offersShared(turn) ? "shared" : "private");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<AppliedCode | null>(null);
  const preview = quote(turn, kind, 1, applied);
  const form = useRef<HTMLFormElement>(null);
  const checkCode = async (codeText: string) => {
    try {
      const whatsapp = form.current ? new FormData(form.current).get("whatsapp") : null;
      setApplied(await sendJson<AppliedCode>(`/api/sites/${data.siteId}/sauna/codes/check`, "POST", { code: codeText, roomId: turn.roomId, turnTypeId: turn.turnTypeId, whatsapp }));
      return null;
    } catch (failure) {
      setApplied(null);
      return (failure as Error).message;
    }
  };
  const submit = async (element: HTMLFormElement) => {
    const values = new FormData(element);
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
  return <form ref={form} className="flex flex-1 flex-col gap-3 sm:grid" onSubmit={event => { event.preventDefault(); void submit(event.currentTarget); }}>
    <TurnBox turn={turn} action={<button type="button" disabled={busy} onClick={onBack} className="min-h-control shrink-0 px-2.5 text-[13px] text-accent-text hover:underline disabled:opacity-55">Cambiar</button>} />

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

    <PersonFields />
    <CodeBox applied={applied} busy={busy} onApply={checkCode} onRemove={() => setApplied(null)} />

    <Amounts totalCents={preview.totalCents} depositCents={preview.depositCents} balanceCents={preview.balanceCents} />
    {preview.discountCents > 0 && <p className="m-0 text-xs text-muted">El precio ya tiene el descuento de {formatCents(preview.discountCents)}.</p>}
    {applied && preview.confirmsAtOnce && <p className="m-0 text-[13px] text-muted">Con este código no pagás seña: la reserva queda confirmada al instante.</p>}
    <Cancellation rules={data.rules} />

    {error && <Notice kind="error">{error}</Notice>}
    {data.preview && <Notice>Es una vista previa: desde acá no se toman reservas.</Notice>}
    <SubmitBar busy={busy} disabled={busy || data.preview} label="Reservar" busyLabel="Reservando…" termsHref={data.termsHref} />
  </form>;
}

/**
 * A plan's request: every turn chosen, who books, a code if the plan takes one, and the plan's own amounts. sauna_reserve_plan checks the turns and
 * the code again and decides the discount and the deposit.
 */
function PlanForm({ plan, turns, data, onBack }: { plan: PublicPlan; turns: Turn[]; data: BookingFlowData; onBack: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<AppliedCode | null>(null);
  const amounts = planQuote(plan, data.depositPercent, applied);
  const form = useRef<HTMLFormElement>(null);
  const checkCode = async (codeText: string) => {
    try {
      const whatsapp = form.current ? new FormData(form.current).get("whatsapp") : null;
      setApplied(await sendJson<AppliedCode>(`/api/sites/${data.siteId}/sauna/codes/check`, "POST", {
        code: codeText, planId: plan.id, turns: turns.map(turn => ({ roomId: turn.roomId, turnTypeId: turn.turnTypeId })), whatsapp,
      }));
      return null;
    } catch (failure) {
      setApplied(null);
      return (failure as Error).message;
    }
  };
  const submit = async (element: HTMLFormElement) => {
    const values = new FormData(element);
    setBusy(true);
    setError("");
    try {
      const { token } = await sendJson<{ token: string }>(`/api/sites/${data.siteId}/sauna/plan-reservations`, "POST", {
        planId: plan.id, turns: turns.map(turn => ({ roomId: turn.roomId, turnTypeId: turn.turnTypeId, startsAt: turn.startsAt })),
        name: values.get("name"), whatsapp: values.get("whatsapp"), code: applied?.code ?? null, termsAccepted: true,
      });
      router.push(`/plan/${token}`);
    } catch (failure) {
      setError((failure as Error).message);
      setBusy(false);
    }
  };
  return <form ref={form} className="flex flex-1 flex-col gap-3 sm:grid" onSubmit={event => { event.preventDefault(); void submit(event.currentTarget); }}>
    <div className="flex items-center justify-between gap-3">
      <p className="m-0 text-[13px] text-ink"><span className="font-semibold">{plan.name}</span> <span className="text-muted">· {turns.length} turnos</span></p>
      <button type="button" disabled={busy} onClick={onBack} className="min-h-control shrink-0 px-2.5 text-[13px] text-accent-text hover:underline disabled:opacity-55">Cambiar turnos</button>
    </div>
    <ol className="m-0 grid list-none gap-1.5 p-0">{turns.map(turn => <li key={turn.startsAt}><TurnBox turn={turn} /></li>)}</ol>
    <PersonFields />
    {plan.allowsCodes && <CodeBox applied={applied} busy={busy} onApply={checkCode} onRemove={() => setApplied(null)} />}
    <Amounts totalLabel="Precio del plan" totalCents={amounts.totalCents} depositCents={amounts.depositCents} balanceCents={amounts.balanceCents} />
    {amounts.discountCents > 0 && <p className="m-0 text-xs text-muted">El precio ya tiene el descuento de {formatCents(amounts.discountCents)}.</p>}
    {applied && amounts.depositCents === 0 && <p className="m-0 text-[13px] text-muted">Con este código no pagás seña: los turnos quedan confirmados al instante.</p>}
    <Cancellation rules={data.rules} />
    {error && <Notice kind="error">{error}</Notice>}
    {data.preview && <Notice>Es una vista previa: desde acá no se toman reservas.</Notice>}
    <SubmitBar busy={busy} disabled={busy || data.preview} label={`Reservar los ${turns.length} turnos`} busyLabel="Reservando…" termsHref={data.termsHref} />
  </form>;
}

/** "Un turno" or one of the plans. Shown only when the site offers plans. */
function ModeChoice({ plans, current, onChange }: { plans: PublicPlan[]; current: string | null; onChange: (planId: string | null) => void }) {
  return <fieldset className="m-0 min-w-0 border-0 p-0">
    <legend className={groupTitle}>¿Cómo querés venir?</legend>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className={`${choiceClass(current === null)} flex min-h-control cursor-pointer flex-col justify-center px-3 py-2.5 text-[13px] has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-focus`}>
        <input className="sr-only" type="radio" name="mode" checked={current === null} onChange={() => onChange(null)} />
        <span className="font-semibold">Un turno</span>
        <span className={current === null ? "" : "text-muted"}>Elegí día y horario</span>
      </label>
      {plans.map(plan => <label key={plan.id} className={`${choiceClass(current === plan.id)} flex min-h-control cursor-pointer flex-col justify-center px-3 py-2.5 text-[13px] has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-focus`}>
        <input className="sr-only" type="radio" name="mode" checked={current === plan.id} onChange={() => onChange(plan.id)} />
        <span className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 font-semibold"><Layers size={14} aria-hidden="true" />{plan.name}</span><span className="tabular-nums">{formatCents(plan.priceCents)}</span></span>
        <span className={current === plan.id ? "" : "text-muted"}>{planSummary(plan)}</span>
      </label>)}
    </div>
  </fieldset>;
}

export function BookingFlow({ data }: { data: BookingFlowData }) {
  const lastDay = addDays(data.today, data.maxAdvanceDays);
  const [first, setFirst] = useState(data.firstDay);
  const [day, setDay] = useState(data.firstDay);
  const [result, setResult] = useState<{ from: DateText; turns: Turn[] } | null>(null);
  const [error, setError] = useState("");
  const [hour, setHour] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Turn | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [picks, setPicks] = useState<Turn[]>([]);
  const [pickError, setPickError] = useState("");
  const [planReady, setPlanReady] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const plan = data.plans.find(item => item.id === planId) ?? null;
  const load = useCallback(async () => {
    setError("");
    try {
      const turns = await fetchJson<Turn[]>(`/api/sites/${data.siteId}/sauna/availability?from=${first}&to=${addDays(first, DAYS_SHOWN - 1)}`);
      setResult({ from: first, turns });
    } catch (failure) { setError((failure as Error).message); }
  }, [data.siteId, first]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  // Each step replaces the content: whoever uses a screen reader or a keyboard has to land on its title.
  useEffect(() => { heading.current?.focus(); }, [chosen, planReady]);

  const second = chosen !== null || planReady;
  const title = <>
    <Steps current={second ? 2 : 1} />
    {/* Focused from code, only to place the reader: it is not a control, so no ring. */}
    <h2 id="booking-title" ref={heading} tabIndex={-1} className="m-0 mb-3 font-display text-2xl/snug font-normal text-ink outline-none">{second ? (plan ? `Completá tu ${plan.name}` : "Completá tu reserva") : "Reservá tu momento"}</h2>
  </>;

  if (chosen) return <>{title}<BookingForm turn={chosen} data={data} onBack={() => { setChosen(null); setHour(null); void load(); }} /></>;
  if (plan && planReady) return <>{title}<PlanForm plan={plan} turns={picks} data={data} onBack={() => { setPlanReady(false); setHour(null); void load(); }} /></>;

  const forPlan = plan !== null;
  const usable = forPlan ? canChooseForPlan : canChoose;
  const pickedDays = new Set(picks.map(turn => businessDate(turn.startsAt)));
  const dates = Array.from({ length: DAYS_SHOWN }, (_, index) => addDays(first, index));
  const loaded = result?.from === first;
  // A plan only shows the turns of its length.
  const turnsOf = (date: DateText) => loaded ? result.turns.filter(turn => businessDate(turn.startsAt) === date && (!plan || fitsPlan(turn, plan))) : [];
  const startsOf = (date: DateText) => [...turnsOf(date).reduce((all, turn) => all.set(turn.startsAt, [...(all.get(turn.startsAt) ?? []), turn]), new Map<string, Turn[]>())];
  const starts = startsOf(day);
  const options = starts.find(([startsAt]) => startsAt === hour)?.[1] ?? [];
  const openDay = (date: DateText) => { setDay(date); setHour(null); };
  const page = (start: DateText) => { setFirst(start); openDay(start); };
  const changeMode = (id: string | null) => { setPlanId(id); setPicks([]); setPickError(""); setHour(null); };
  // In a plan a turn is added to the list; alone, it goes to the form.
  const take = (turn: Turn) => {
    if (!plan) { setChosen(turn); return; }
    const problem = planProblem([...picks, turn].map(each => each.startsAt), plan, false);
    if (problem) { setPickError(planRejectionMessages[problem]); return; }
    setPickError("");
    setPicks(current => [...current, turn].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)));
    setHour(null);
  };
  const remove = (turn: Turn) => { setPicks(current => current.filter(each => each !== turn)); setPickError(""); };
  // With a single type there is nothing to compare: the time goes straight on.
  const pickHour = (startsAt: string, available: Turn[]) => { if (available.length === 1) take(available[0]); else setHour(startsAt); };
  const arrow = "grid size-control place-items-center rounded-full border border-line-strong text-ink transition-colors duration-150 enabled:hover:bg-surface disabled:opacity-40";
  const complete = plan !== null && picks.length === plan.turns;
  return <>
    {title}
    <div className="grid content-start gap-4 pb-6 sm:pb-0">
      {data.firstDay > data.today && <p className="m-0 rounded-field border border-accent bg-accent-soft px-3 py-2 text-[13px] text-ink">Abrimos el <strong className="font-semibold">{dayLabel(data.firstDay)}</strong>: ya podés reservar desde ese día.</p>}
      {data.plans.length > 0 && <ModeChoice plans={data.plans} current={planId} onChange={changeMode} />}
      {plan && <div className="grid gap-2 rounded-field border border-line-strong bg-surface p-3 text-[13px]" aria-live="polite">
        <p className="m-0 flex items-center justify-between gap-2 text-ink">
          <span className="font-semibold">Tus turnos: {picks.length} de {plan.turns}</span>
          <span className="text-muted">Uno por día, dentro de {plan.windowDays} días</span>
        </p>
        {picks.length > 0 && <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {picks.map(turn => <li key={turn.startsAt} className="flex items-center gap-1 rounded-full border border-accent bg-accent-soft py-1 pr-1 pl-2.5 text-ink">
            <span className="first-letter:uppercase">{shortDayLabel(businessDate(turn.startsAt))} · {businessTime(turn.startsAt)}</span>
            <button type="button" onClick={() => remove(turn)} aria-label={`Quitar el turno del ${dayLabel(businessDate(turn.startsAt))} a las ${businessTime(turn.startsAt)}`} className="grid size-6 place-items-center rounded-full text-muted hover:bg-bg hover:text-ink"><X size={14} aria-hidden="true" /></button>
          </li>)}
        </ul>}
        {pickError && <p role="alert" className="m-0 text-danger">{pickError}</p>}
      </div>}

      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className={`${groupTitle} mb-0 font-text`}>{plan ? (complete ? "Ya elegiste todos los turnos" : `Elegí el turno ${picks.length + 1} de ${plan.turns}`) : "¿Qué día querés venir?"}</h3>
          <div className="flex gap-1.5">
            <button type="button" aria-label="Días anteriores" className={arrow} disabled={first <= data.firstDay} onClick={() => page(addDays(first, -DAYS_SHOWN) < data.firstDay ? data.firstDay : addDays(first, -DAYS_SHOWN))}><ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" /></button>
            <button type="button" aria-label="Días siguientes" className={arrow} disabled={addDays(first, DAYS_SHOWN) > lastDay} onClick={() => page(addDays(first, DAYS_SHOWN))}><ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" /></button>
          </div>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:thin]" role="group" aria-label="Elegí un día">
          {dates.map(date => {
            const open = startsOf(date).filter(([, available]) => available.some(usable)).length;
            const picked = pickedDays.has(date);
            return <button key={date} type="button" aria-pressed={date === day} disabled={date > lastDay} onClick={() => openDay(date)} className={`${choiceClass(date === day)} relative grid min-w-14 flex-1 justify-items-center gap-0.5 px-0.5 py-2.5`}>
              {picked && <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-accent text-accent-ink" aria-hidden="true"><Check size={10} strokeWidth={3} /></span>}
              <span className="font-display text-2xl/none">{Number(date.slice(8))}</span>
              <span className="text-[11px] first-letter:uppercase">{shortDayLabel(date).split(" ")[0]}</span>
              <span className={`text-[10px] ${date === day ? "" : "text-muted"}`}>{!loaded ? " " : picked ? "Elegido" : open === 0 ? "Sin turnos" : `${open} ${open === 1 ? "turno" : "turnos"}`}</span>
            </button>;
          })}
        </div>
      </div>

      <div className="min-w-0">
        <h3 className={`${groupTitle} font-text first-letter:uppercase`}>{dayLabel(day)}</h3>
        {error && <div className="grid justify-items-start gap-2"><Notice kind="error">{error}</Notice><Button onClick={() => void load()}>Reintentar</Button></div>}
        {!loaded && !error && <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5" aria-busy="true" aria-label="Buscando turnos">{Array.from({ length: 5 }, (_, index) => <span key={index} className="min-h-control animate-pulse rounded-field bg-surface" />)}</div>}
        {loaded && starts.length === 0 && <p className="m-0 text-sm text-muted">Este día no hay turnos. Probá con otro.</p>}
        {plan && pickedDays.has(day) && <p className="m-0 mb-2 text-sm text-muted">Ya elegiste un turno este día. Elegí otro día, o quitá ese turno arriba.</p>}
        {starts.length > 0 && <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5" role="group" aria-label="Elegí un horario">
          {starts.map(([startsAt, available]) => {
            const open = available.filter(usable);
            const blocked = complete || (plan !== null && pickedDays.has(day));
            return <button key={startsAt} type="button" className={`${choiceClass(hour === startsAt)} min-h-control px-1 text-[13px] tabular-nums`} aria-pressed={hour === startsAt} disabled={!open.length || blocked} onClick={() => pickHour(startsAt, open)}>{businessTime(startsAt)}</button>;
          })}
        </div>}
        {loaded && starts.length > 0 && !starts.some(([, available]) => available.some(usable)) && <p className="m-0 mt-2 text-sm text-muted">{starts[0][1][0].closed ? "Este día está cerrado." : "No quedan turnos este día. Probá con otro."}</p>}
      </div>

      {options.length > 0 && <div className="grid gap-2 sm:grid-cols-2">
        {options.map(turn => <button key={turn.turnTypeId} type="button" className={`${choiceClass(false)} grid min-h-control justify-items-start px-3 py-2.5 text-left`} disabled={!usable(turn)} onClick={() => take(turn)}>
          <span className="text-[13px]">{turn.typeName}</span>
          <span className="text-xs text-muted">{optionText(turn, forPlan)}</span>
        </button>)}
      </div>}

      {plan
        ? <div className="sticky bottom-0 -mx-5 grid gap-1.5 border-t border-line bg-bg px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:p-0">
          <button type="button" disabled={!complete} onClick={() => setPlanReady(true)} className="flex min-h-control w-full items-center justify-between rounded-control bg-accent px-4 py-3.5 text-sm text-accent-ink transition-[background-color,transform] duration-150 enabled:hover:bg-accent-hover enabled:active:scale-[0.98] disabled:opacity-55">
            {complete ? "Continuar" : `Elegí ${plan.turns - picks.length} ${plan.turns - picks.length === 1 ? "turno más" : "turnos más"}`}<ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <p className="m-0 text-center text-xs text-muted">{formatCents(plan.priceCents)} por los {plan.turns} turnos. Seña de {formatCents(planQuote(plan, data.depositPercent).depositCents)} antes de confirmar.</p>
        </div>
        : <p className="m-0 text-xs text-muted">Vas a ver el precio y la seña antes de confirmar.</p>}
    </div>
  </>;
}
