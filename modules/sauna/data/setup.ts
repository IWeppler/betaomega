import { rpc, siteTable } from "@/platform/db";
import type { TimeBand, TurnType, WeekRequest } from "../domain/hours";
import type { ClosureEntry, NewClosure, Room, Settings } from "../domain/setup";

const missing = "Falta la configuración del sauna: corré supabase/schema.sql.";

export class SetupConflictError extends Error {
  constructor() { super("Alguien más cambió estos datos. Recargá la página antes de guardar."); }
}

type SettingsRow = {
  deposit_percent: number; min_lead_minutes: number; max_advance_days: number; mp_hold_minutes: number; transfer_hold_hours: number;
  contact_whatsapp: string | null; start_step_minutes: number; revision: number;
  transfer_alias: string | null; transfer_cbu: string | null; transfer_holder: string | null;
};
type RoomRow = { id: string; name: string; capacity: number; active: boolean; revision: number };
type TypeRow = { id: string; name: string; duration_minutes: number; price_cents: number | null; private_price_cents: number | null; deposit_percent: number | null; active: boolean; revision: number };
type BandRow = { weekday: number; start_time: string; end_time: string; sauna_band_types: { turn_type_id: string }[] };
type ClosureRow = { id: string; room_id: string | null; starts_at: string; ends_at: string; reason: string };

const settingsTable = (siteId: string) => siteTable<SettingsRow>("sauna_settings", siteId, missing);
const roomsTable = (siteId: string) => siteTable<RoomRow>("sauna_rooms", siteId, missing);
const typesTable = (siteId: string) => siteTable<TypeRow>("sauna_turn_types", siteId, missing);
const bandsTable = (siteId: string) => siteTable<BandRow>("sauna_time_bands", siteId, missing);
const closuresTable = (siteId: string) => siteTable<ClosureRow>("sauna_closures", siteId, missing);

const settingsFrom = (row: SettingsRow): Settings => ({
  depositPercent: row.deposit_percent, minLeadMinutes: row.min_lead_minutes, maxAdvanceDays: row.max_advance_days, mpHoldMinutes: row.mp_hold_minutes,
  transferHoldHours: row.transfer_hold_hours, contactWhatsapp: row.contact_whatsapp, startStepMinutes: row.start_step_minutes,
  transferAlias: row.transfer_alias ?? null, transferCbu: row.transfer_cbu ?? null, transferHolder: row.transfer_holder ?? null, revision: row.revision,
});
const roomFrom = (row: RoomRow): Room => ({ id: row.id, name: row.name, capacity: row.capacity, active: row.active, revision: row.revision });
const typeFrom = (row: TypeRow): TurnType => ({
  id: row.id, name: row.name, durationMinutes: row.duration_minutes, priceCents: row.price_cents, privatePriceCents: row.private_price_cents, depositPercent: row.deposit_percent, active: row.active, revision: row.revision,
});
const bandFrom = (row: BandRow): TimeBand => ({ weekday: row.weekday, from: row.start_time.slice(0, 5), to: row.end_time.slice(0, 5), typeIds: row.sauna_band_types.map(link => link.turn_type_id) });
const closureFrom = (row: ClosureRow): ClosureEntry => ({ id: row.id, roomId: row.room_id, startsAt: row.starts_at, endsAt: row.ends_at, reason: row.reason });

export async function readSettings(siteId: string): Promise<Settings | null> {
  const [row] = await settingsTable(siteId)("select=*");
  return row ? settingsFrom(row) : null;
}

export const listRooms = async (siteId: string) => (await roomsTable(siteId)("select=*&order=name.asc")).map(roomFrom);
export const listTurnTypes = async (siteId: string) => (await typesTable(siteId)("active=is.true&select=*&order=duration_minutes.asc,name.asc")).map(typeFrom);
export const listBands = async (siteId: string) => (await bandsTable(siteId)("select=weekday,start_time,end_time,sauna_band_types(turn_type_id)&order=weekday.asc,start_time.asc")).map(bandFrom);

/** Closures that have not ended, soonest first. Past ones keep no purpose on screen. */
export const listClosures = async (siteId: string) =>
  (await closuresTable(siteId)(`ends_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*&order=starts_at.asc`)).map(closureFrom);

// Pattern 4: the revision filter and the update are one statement, so two saves cannot both win.
export async function saveSettings(siteId: string, settings: Settings): Promise<Settings> {
  const { revision } = settings;
  const [row] = await settingsTable(siteId)(`revision=eq.${revision}`, {
    method: "PATCH",
    body: JSON.stringify({
      deposit_percent: settings.depositPercent, min_lead_minutes: settings.minLeadMinutes, max_advance_days: settings.maxAdvanceDays, mp_hold_minutes: settings.mpHoldMinutes,
      transfer_hold_hours: settings.transferHoldHours, contact_whatsapp: settings.contactWhatsapp, start_step_minutes: settings.startStepMinutes,
      transfer_alias: settings.transferAlias, transfer_cbu: settings.transferCbu, transfer_holder: settings.transferHolder, revision: revision + 1,
    }),
  });
  if (!row) throw new SetupConflictError();
  return settingsFrom(row);
}

/** Types are few, and each keeps its own revision, so one request per change. An inactive type is how one is removed: past bookings point at it. */
export async function saveTurnType(siteId: string, type: TurnType): Promise<void> {
  const fields = {
    name: type.name, duration_minutes: type.durationMinutes, price_cents: type.priceCents, private_price_cents: type.privatePriceCents, deposit_percent: type.depositPercent, active: type.active,
  };
  if (!type.id) {
    await typesTable(siteId)("", { method: "POST", body: JSON.stringify(fields) });
    return;
  }
  const [row] = await typesTable(siteId)(`id=eq.${type.id}&revision=eq.${type.revision}`, { method: "PATCH", body: JSON.stringify({ ...fields, revision: type.revision + 1 }) });
  if (!row) throw new SetupConflictError();
}

/** The whole week in one transaction, with the revision checked inside it. */
export async function saveWeek(siteId: string, week: WeekRequest): Promise<void> {
  const result = await rpc<{ ok: boolean }>("sauna_save_week", { p_site: siteId, p_revision: week.revision, p_capacity: week.capacity, p_step: week.stepMinutes, p_bands: week.bands });
  if (!result.ok) throw new SetupConflictError();
}

export async function addClosure(siteId: string, closure: NewClosure): Promise<ClosureEntry> {
  const [row] = await closuresTable(siteId)("", {
    method: "POST",
    body: JSON.stringify({ room_id: closure.roomId, starts_at: closure.startsAt, ends_at: closure.endsAt, reason: closure.reason }),
  });
  return closureFrom(row);
}

export const removeClosure = async (siteId: string, id: string) => { await closuresTable(siteId)(`id=eq.${id}`, { method: "DELETE" }); };
