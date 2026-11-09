import type { ReactNode } from "react";
import { CalendarPlus, Check, CircleCheckBig, Clock, CircleX } from "lucide-react";
import type { BookingStatus } from "../domain/booking";
import { buttonClass } from "./controls";

// The top of the page a person lands on after booking, for a single turn and for a plan: where they are, what is missing and what comes next.

/** Where a booking is on its way to confirmed. "closed" is anything that will not get there (cancelled, expired) or is already over. */
export type Stage = "pay" | "transfer" | "done" | "closed";

export const stageOf = (status: BookingStatus): Stage =>
  status === "held" ? "pay" : status === "pending_transfer" ? "transfer" : status === "confirmed" ? "done" : "closed";

const steps = ["Elegiste el turno", "Pagás la seña", "Reserva confirmada"];

/** Three steps, the first always done. Only for a booking still on its way: a closed one has nothing to follow. */
export function ProgressSteps({ stage }: { stage: Exclude<Stage, "closed"> }) {
  const current = stage === "done" ? 3 : 2;
  return <ol className="m-0 grid list-none grid-cols-3 gap-2 p-0" aria-label="En qué paso está tu reserva">
    {steps.map((label, index) => {
      const step = index + 1;
      const done = step < current || stage === "done";
      const active = step === current && stage !== "done";
      return <li key={label} aria-current={active ? "step" : undefined} className="grid gap-1.5">
        <span className={`h-1 rounded-full ${done ? "bg-accent" : active ? "bg-accent/45" : "bg-line-strong"}`} aria-hidden="true" />
        <span className={`flex items-center gap-1 text-xs ${done || active ? "text-ink" : "text-muted"}`}>
          {done && <Check size={12} strokeWidth={2.5} className="shrink-0 text-accent-text" aria-hidden="true" />}
          {label}
          {active && stage === "transfer" && <span className="sr-only"> (esperando la transferencia)</span>}
        </span>
      </li>;
    })}
  </ol>;
}

const icons = { pay: Clock, transfer: Clock, done: CircleCheckBig, closed: CircleX };

/** The big answer to "did it work?": an icon, a short line in the accent or plain, and the title. */
export function ResultHero({ stage, eyebrow, title, children }: { stage: Stage; eyebrow: string; title: ReactNode; children?: ReactNode }) {
  const Icon = icons[stage];
  const strong = stage === "done";
  return <div className="grid justify-items-start gap-3">
    <span className={`grid size-14 place-items-center rounded-full ${strong ? "bg-accent text-accent-ink" : stage === "closed" ? "bg-surface text-muted" : "bg-accent-soft text-accent-text"}`} aria-hidden="true">
      <Icon size={28} strokeWidth={1.75} />
    </span>
    <p className={`m-0 text-xs font-semibold tracking-wider uppercase ${strong ? "text-accent-text" : "text-muted"}`}>{eyebrow}</p>
    <h1 className="m-0 font-display text-3xl/snug font-normal text-ink">{title}</h1>
    {children}
  </div>;
}

/** Back to the home page with the booking open. A plain link: the booking dialog opens from the address. */
export function BookAnother({ primary }: { primary: boolean }) {
  return <a className={buttonClass(primary ? "primary" : "quiet")} href="/#reservar"><CalendarPlus size={16} aria-hidden="true" />Reservar otro turno</a>;
}
