import { CalendarPlus, Download } from "lucide-react";
import { googleCalendarUrl, icsFile, icsHref, type CalendarEvent } from "../domain/calendar";
import { businessDate, businessTime, dayLabel } from "../domain/time";
import { buttonClass, Card } from "./controls";

/**
 * "Add to calendar" for confirmed turns. No account and nothing stored: a link that fills Google Calendar in, and an .ics file that Apple Calendar, Outlook and the rest open
 * (it carries a reminder a day and an hour before). A plan has one file with every turn, and a Google link for each.
 */
export function AddToCalendar({ events, now, link }: { events: CalendarEvent[]; now: string; link: string }) {
  if (events.length === 0) return null;
  const many = events.length > 1;
  const file = icsHref(icsFile(events, { now, host: new URL(link).host }));
  return <Card className="grid gap-3">
    <h2 className="m-0 font-display text-lg font-normal text-ink">{many ? "Agregá tus turnos al calendario" : "Agregá tu turno al calendario"}</h2>
    <p className="m-0 text-muted">{many ? "El archivo trae todos los turnos" : "El archivo"} con un aviso un día y una hora antes. En Google Calendar, el aviso es el que tengas configurado.</p>
    <div className="flex flex-wrap gap-2">
      {!many && <a className={buttonClass("quiet", "lg")} href={googleCalendarUrl(events[0])} target="_blank" rel="noopener noreferrer"><CalendarPlus size={16} aria-hidden="true" />Google Calendar</a>}
      <a className={buttonClass(many ? "primary" : "quiet", "lg")} href={file} download="reserva.ics"><Download size={16} aria-hidden="true" />{many ? `Descargar los ${events.length} turnos (.ics)` : "Apple, Outlook y otros (.ics)"}</a>
    </div>
    {many && <details className="text-muted">
      <summary className="min-h-control cursor-pointer py-2 text-ink">Agregar uno por uno a Google Calendar</summary>
      <ul className="m-0 grid list-none gap-1 p-0">
        {events.map(event => <li key={event.startsAt}><a className="inline-flex min-h-control items-center text-accent-text no-underline hover:underline" href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer"><span className="first-letter:uppercase">{dayLabel(businessDate(event.startsAt))}</span>, {businessTime(event.startsAt)}</a></li>)}
      </ul>
    </details>}
  </Card>;
}
