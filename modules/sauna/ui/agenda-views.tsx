"use client";

import { peopleOf, type AgendaTurn } from "../domain/agenda";
import { businessTime, monthGrid, type DateText } from "../domain/time";
import { BookingCard } from "./booking-card";
import { Card, Tag } from "./controls";

export function DayAgenda({ turns, closed, rooms, now, onChanged }: { turns: AgendaTurn[]; closed: boolean; rooms: Record<string, string>; now: string; onChanged: () => Promise<void> }) {
  const manyRooms = Object.keys(rooms).length > 1;
  return <div className="grid gap-3">
    {closed && <div><Tag tone="warn">Ocupado: no se toman reservas nuevas</Tag></div>}
    {!turns.length && <p className="m-0 text-muted">Este día no tiene reservas.</p>}
    {turns.map(entry => <Card key={entry.key} className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="m-0 text-lg font-semibold text-ink">{businessTime(entry.startsAt)} a {businessTime(entry.endsAt)}</h3>
        {entry.typeName && <span className="text-muted">{entry.typeName}</span>}
        {manyRooms && <span className="text-muted">{rooms[entry.roomId]}</span>}
      </div>
      <div className="grid gap-2">{entry.bookings.map(booking => <BookingCard key={booking.id} booking={booking} now={now} onChanged={onChanged} />)}</div>
    </Card>)}
  </div>;
}

const dayButton = "w-full rounded-field border border-line bg-surface p-2 text-left text-ink transition-colors duration-150 hover:bg-sunken";

const weekdayHeads = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function MonthAgenda({ date, days, closureState, today, selected, onOpen }: { date: DateText; days: Map<DateText, AgendaTurn[]>; closureState: (day: DateText) => "full" | "partial" | null; today: DateText; selected: string | null; onOpen: (day: DateText) => void }) {
  const month = date.slice(0, 7);
  return <div className="grid grid-cols-7 gap-1">
    {weekdayHeads.map(head => <span key={head} className="text-center text-sm font-semibold text-muted">{head}</span>)}
    {monthGrid(date).map(day => {
      const people = peopleOf(days.get(day) ?? []);
      return <button key={day} type="button" className={`${dayButton} grid min-h-16 min-w-0 content-start gap-0.5 px-1 break-words whitespace-normal sm:p-2 ${day.slice(0, 7) === month ? "" : "opacity-55"} ${selected === day ? "border-accent bg-accent-soft" : ""}`} aria-pressed={selected === day} aria-current={day === today ? "date" : undefined} aria-label={`${day}: ${people} ${people === 1 ? "persona" : "personas"}${closureState(day) ? `, ${closureState(day) === "full" ? "Ocupado" : "Ocupado en parte"}` : ""}`} onClick={() => onOpen(day)}>
        <span className={`font-semibold ${day === today ? "text-accent-text" : ""}`}>{Number(day.slice(8))}</span>
        {people > 0 && <span className="text-sm font-semibold">{people}</span>}
        {closureState(day) && <span className="min-w-0 text-xs break-words text-muted">{closureState(day) === "full" ? "Ocupado" : "Ocupado en parte"}</span>}
      </button>;
    })}
  </div>;
}

