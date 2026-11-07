import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { slotModes } from "./domain/availability.ts";
import { bookingKinds, bookingStatuses } from "./domain/booking.ts";
import { packStatuses } from "./domain/pack.ts";
import { paymentKinds, paymentMethods } from "./domain/payments.ts";
import { codeTypes } from "./domain/pricing.ts";
import { paymentOutcomes, reserveRejections, transferRejections } from "./domain/rejections.ts";

// There is no test database (docs/ROADMAP.md §5), so nothing here runs the SQL. These tests read supabase/schema.sql as text and guard what can
// still drift or be forgotten: the agreements with the domain and the conventions of docs/CONVENTIONS.md §6.

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../../supabase/schema.sql");
const start = schema.indexOf("-- Sauna (docs/SAUNA.md §5");
assert.notEqual(start, -1, "falta la sección del sauna en schema.sql");
const sauna = schema.slice(start);

const tables = [...sauna.matchAll(/create table if not exists public\.(\w+) \(([\s\S]*?)\n\);/g)].map(([, name, body]) => ({ name, body }));
const definitions = [...sauna.matchAll(/create or replace function public\.(\w+)\(([\s\S]*?)\)\nreturns ([\s\S]*?)\nas \$\$([\s\S]*?)\$\$;/g)]
  .map(([, name, params, header, body]) => ({ name, params, header, body }));
// Appended migrations may replace a function: assertions must cover what will actually run.
const functions = [...new Map(definitions.map(fn => [fn.name, fn])).values()];
const body = (name: string) => {
  const found = functions.find(fn => fn.name === name);
  assert.ok(found, `falta la función ${name}`);
  return found.body;
};
const table = (name: string) => {
  const found = tables.find(item => item.name === name);
  assert.ok(found, `falta la tabla ${name}`);
  return found.body;
};
/** The values of `column in ('a', 'b')` in a table's check. */
const allowedIn = (tableName: string, column: string) => {
  const match = table(tableName).match(new RegExp(`^\\s*${column} text[^\\n]*check \\(${column} in \\(([^)]*)\\)\\)`, "m"));
  assert.ok(match, `${tableName}.${column} no tiene su check`);
  return match[1].split(",").map(value => value.trim().replace(/'/g, ""));
};

test("están todas las tablas del modelo", () => {
  assert.deepEqual(tables.map(item => item.name).sort(), [
    "booking_events", "cancellation_policies", "customers", "discount_codes", "payments", "sauna_band_types", "sauna_bookings", "sauna_closures", "sauna_code_attempts", "sauna_mercadopago_accounts",
    "sauna_pack_plans", "sauna_pack_purchases", "sauna_rooms", "sauna_schedules", "sauna_settings", "sauna_slots", "sauna_time_bands", "sauna_turn_types",
  ]);
});

test("toda tabla pertenece a un sitio y solo entra el servidor", () => {
  for (const { name, body: columns } of tables) {
    assert.match(columns, /site_id text (not null|primary key) references public\.sites \(id\)/, `${name}: site_id`);
    assert.ok(sauna.includes(`alter table public.${name} enable row level security;`), `${name}: RLS`);
    assert.ok(sauna.includes(`revoke all on public.${name} from anon, authenticated;`), `${name}: revoke`);
  }
});

test("una fila nunca puede apuntar a otro sitio: las claves foráneas internas incluyen site_id", () => {
  for (const { name, body: columns } of tables) {
    for (const line of columns.split("\n").filter(text => /references public\./.test(text) && !/public\.sites/.test(text))) {
      assert.match(line, /foreign key \(site_id, \w+\) references public\.\w+ \(site_id, id\)/, `${name}: ${line.trim()}`);
    }
  }
});

test("el dinero se guarda en centavos enteros", () => {
  const columns = [...tables.flatMap(item => [...item.body.matchAll(/^\s*(\w*_cents) (\w+)/gm)])];
  assert.ok(columns.length >= 8);
  for (const [, name, type] of columns) assert.equal(type, "bigint", name);
  assert.doesNotMatch(sauna, /\b(numeric|decimal|real|double precision|float\d?)\b/);
});

test("los estados y tipos de la base coinciden con los del dominio", () => {
  assert.deepEqual(allowedIn("sauna_bookings", "status"), [...bookingStatuses]);
  assert.deepEqual(allowedIn("sauna_bookings", "kind"), [...bookingKinds]);
  assert.deepEqual(allowedIn("sauna_pack_purchases", "status"), [...packStatuses]);
  assert.deepEqual(allowedIn("sauna_schedules", "mode"), [...slotModes]);
  assert.deepEqual(allowedIn("sauna_slots", "mode"), [...slotModes]);
  assert.deepEqual(allowedIn("discount_codes", "type"), [...codeTypes]);
  assert.deepEqual(allowedIn("payments", "method"), [...paymentMethods]);
  assert.deepEqual(allowedIn("payments", "kind"), [...paymentKinds]);
});

test("el porcentaje redondea con la misma fórmula en la base y en platform/money", () => {
  assert.match(body("sauna_percent_of"), /\(p_cents \* p_percent \+ 50\) \/ 100/);
  assert.match(read("../../platform/money/index.ts"), /Math\.floor\(\(cents \* percent \+ 50\) \/ 100\)/);
});

test("sauna_reserve rechaza exactamente con los motivos del dominio", () => {
  const reasons = new Set([...body("sauna_reserve_core").matchAll(/sauna_reject\('(\w+)'\)/g)].map(match => match[1]));
  assert.deepEqual([...reasons].sort(), [...reserveRejections].sort());
});

test("sauna_confirm_payment devuelve exactamente los resultados del dominio", () => {
  const code = body("sauna_confirm_payment");
  const found = new Set([...code.matchAll(/v_outcome := '(\w+)'/g)].map(match => match[1]));
  found.add("duplicate");
  assert.match(code, /'outcome', 'duplicate'/);
  assert.deepEqual([...found].sort(), [...paymentOutcomes].sort());
});

test("sauna_reserve toma los bloqueos que evitan vender dos veces lo mismo", () => {
  const code = body("sauna_reserve_core");
  assert.match(code, /from public\.sauna_pack_purchases where[^;]*for update;/);
  assert.match(code, /from public\.sauna_rooms r where[^;]*for update;/);
  assert.match(code, /from public\.discount_codes c[^;]*for update;/);
  const order = ["public.sauna_pack_purchases where", "public.sauna_rooms r where", "public.discount_codes c"].map(text => code.indexOf(text));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "el orden de los bloqueos es compra → sala → código");
});

test("confirmar un pago bloquea la sala antes que la reserva, como al reservar", () => {
  const code = body("sauna_confirm_payment");
  assert.ok(code.indexOf("public.sauna_rooms r where") < code.indexOf("public.sauna_bookings b where b.site_id = p_site and b.id = p_booking for update"));
});

test("toda función corre con los permisos de quien llama y con search_path vacío", () => {
  assert.ok(functions.length >= 13);
  for (const { name, header } of functions) {
    assert.match(header, /security invoker/, `${name}: security invoker`);
    assert.match(header, /set search_path = ''/, `${name}: search_path`);
    assert.ok(new RegExp(`revoke execute on function public\\.${name}\\([^)]*\\) from public, anon, authenticated;`).test(sauna), `${name}: revoke`);
  }
});

test("solo el servidor puede llamar a las funciones", () => {
  for (const { name, header } of functions) {
    if (/^trigger/.test(header)) continue; // a trigger function is never called directly
    assert.ok(new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to service_role;`).test(sauna), `${name}: grant`);
  }
});

test("toda función sobre datos recibe primero el sitio y filtra por él", () => {
  const scoped = functions.filter(({ params }) => /\bp_site\b/.test(params));
  assert.deepEqual(scoped.map(fn => fn.name).sort(), [
    "sauna_anonymize_customer", "sauna_availability", "sauna_availability_core", "sauna_cancel", "sauna_choose_transfer", "sauna_confirm_payment", "sauna_is_closed", "sauna_manual_availability", "sauna_peak_seats", "sauna_record_refund", "sauna_reserve", "sauna_reserve_core", "sauna_reserve_manual", "sauna_save_week", "sauna_set_status",
  ]);
  for (const { name, params, body: code } of scoped) {
    assert.match(params, /^\s*p_site text/, `${name}: primer argumento`);
    assert.match(code, /site_id = p_site|public\.sauna_\w+_core\(p_site,/, `${name}: filtro o delegación acotada`);
  }
});

test("una fila se escribe solo acotada a su sitio", () => {
  for (const { name, body: code } of functions) {
    for (const [statement] of code.matchAll(/\bupdate public\.\w+[\s\S]*?;/g)) {
      assert.match(statement, /site_id = p_site/, `${name}: ${statement.slice(0, 60)}`);
    }
  }
});

test("correr el archivo de nuevo no falla ni pisa datos", () => {
  assert.doesNotMatch(sauna, /create table public\./);
  assert.doesNotMatch(sauna, /create (unique )?index (?!if not exists)/);
  for (const [statement] of sauna.matchAll(/^insert into public\.[\s\S]*?;$/gm)) {
    assert.match(statement, /on conflict|where not exists/, statement.slice(0, 60));
  }
  for (const [, name] of sauna.matchAll(/^create trigger (\w+) /gm)) {
    assert.ok(sauna.includes(`drop trigger if exists ${name} `), `${name}: falta el drop`);
  }
});

test("fropexio nace inactivo y sin plantilla de horarios cargada", () => {
  assert.match(sauna, /\('fropexio', 'sauna', 'Fropexio', 'https:\/\/fropexio\.vercel\.app', null, null, '\{\}', false, 4\)/);
  assert.doesNotMatch(sauna, /^insert into public\.sauna_(rooms|schedules)/m);
});

test("el cupo se cuenta por solapamiento, al reservar, con un pago tardío y al mostrar los turnos", () => {
  for (const name of ["sauna_reserve_core", "sauna_confirm_payment", "sauna_availability_core"]) assert.match(body(name), /sauna_peak_seats\(p_site/, name);
});

test("una sola reserva vigente llena la sala, sin sumar lugares", () => {
  assert.match(body("sauna_peak_seats"), /case when exists/);
  assert.match(body("sauna_peak_seats"), /r\.capacity/);
  assert.doesNotMatch(body("sauna_peak_seats"), /sum\(/);
});

test("no quedan las firmas viejas de las funciones que cambiaron", () => {
  assert.ok(sauna.includes("drop function if exists public.sauna_reserve(text, uuid, timestamptz, text, integer, text, text, text, text, boolean);"));
  assert.ok(sauna.includes("drop function if exists public.sauna_availability(text, date, date);"));
  assert.ok(sauna.includes("drop function if exists public.sauna_seats_taken(text, uuid);"));
});

test("el libro de movimientos no se puede editar", () => {
  assert.match(sauna, /create trigger payments_append_only before update or delete on public\.payments/);
  assert.match(body("sauna_payments_append_only"), /to_jsonb\(new\) - 'raw' - 'note'/);
});

test("público y panel delegan en las mismas reglas sin permitir que el visitante elija el modo manual", () => {
  assert.match(body("sauna_reserve"), /p_terms_accepted, false, null, null/);
  assert.match(body("sauna_reserve_manual"), /null, null, false, true, p_request_id, p_expected_price/);
  assert.match(body("sauna_availability"), /sauna_availability_core\(p_site, p_from, p_to, false\)/);
  assert.match(body("sauna_manual_availability"), /sauna_availability_core\(p_site, p_from, p_to, true\)/);
  const code = body("sauna_reserve_core");
  assert.match(code, /p_manual and p_starts_at <= now\(\)/);
  assert.match(code, /not p_manual and p_starts_at < now\(\) \+ make_interval\(mins => v_settings.min_lead_minutes\)/);
  assert.match(code, /p_starts_at > now\(\) \+ make_interval\(hours => v_settings.max_advance_days \* 24\)/);
  assert.match(code, /not p_manual and p_terms_accepted is not true/);
  assert.ok(code.indexOf("p_starts_at <= clock_timestamp()") < code.indexOf("insert into public.sauna_slots"));
  assert.ok(code.includes("if (p_manual and p_whatsapp !~ '^549[0-9]{10}$') or char_length(v_name)"));
});

test("la carga manual guarda origen y condiciones pendientes y no crea pagos", () => {
  assert.match(sauna, /alter column terms_accepted_at drop not null/);
  assert.match(sauna, /origin = 'panel' and terms_accepted_at is null and manual_request_id is not null/);
  assert.match(body("sauna_reserve_core"), /v_terms_at timestamptz := case when p_manual then null else now\(\) end/);
  assert.match(body("sauna_reserve_core"), /not p_manual and v_code.type is distinct from 'no_deposit'/);
  assert.match(body("sauna_reserve_core"), /case when p_manual then 'panel' else 'sitio' end/);
  assert.doesNotMatch(body("sauna_reserve_core") + body("sauna_reserve_manual"), /insert into public.payments/);
  assert.match(body("sauna_reserve_core"), /p_manual and v_price is distinct from p_expected_price/);
});

test("los reintentos manuales se serializan por sitio y petición y no repiten la creación", () => {
  const code = body("sauna_reserve_manual");
  assert.ok(code.indexOf("pg_advisory_xact_lock") < code.indexOf("manual_request_id = p_request_id"));
  assert.ok(code.indexOf("manual_request_id = p_request_id") < code.indexOf("return public.sauna_reserve_core"));
  assert.match(code, /b.site_id = p_site and b.manual_request_id = p_request_id/);
  assert.match(code, /s.site_id = p_site[^;]*s.room_id = p_room[^;]*s.turn_type_id = p_turn_type/);
  assert.match(code, /c.site_id = p_site[^;]*c.whatsapp = p_whatsapp/);
  assert.match(sauna, /unique index if not exists sauna_bookings_manual_request on public.sauna_bookings \(site_id, manual_request_id\)/);
  assert.match(body("sauna_reserve_core"), /public.sauna_settings where site_id = p_site for share/);
  assert.match(body("sauna_reserve_core"), /public.sauna_turn_types t[^;]*for share/);
});

test("anonimizar borra la identidad y lo que pueda identificar, y conserva los movimientos", () => {
  const code = body("sauna_anonymize_customer");
  assert.match(code, /name = '', whatsapp = null/);
  assert.match(code, /update public\.booking_events/);
  assert.match(code, /note = '', raw = null/);
  assert.doesNotMatch(code, /delete from/);
});

test("elegir transferencia rechaza exactamente con los motivos del dominio", () => {
  const reasons = new Set([...body("sauna_choose_transfer").matchAll(/sauna_reject\('(\w+)'\)/g)].map(match => match[1]));
  assert.deepEqual([...reasons].sort(), [...transferRejections].sort());
});

test("elegir transferencia bloquea la sala antes que la reserva y nunca pasa del inicio del turno", () => {
  const code = body("sauna_choose_transfer");
  assert.ok(code.indexOf("public.sauna_rooms r where") < code.indexOf("public.sauna_bookings b where b.site_id = p_site and b.id = p_booking for update"));
  assert.match(code, /least\(now\(\) \+ make_interval\(hours => v_settings\.transfer_hold_hours\), v_slot\.starts_at\)/);
  assert.match(code, /v_booking\.status <> 'held' or v_booking\.expires_at <= now\(\)/);
});

test("los datos de transferencia de la base tienen el mismo formato que valida el panel", () => {
  assert.match(sauna, /transfer_alias text check \(transfer_alias ~ '\^\[A-Za-z0-9\.-\]\{6,20\}\$'\)/);
  assert.match(sauna, /transfer_cbu text check \(transfer_cbu ~ '\^\[0-9\]\{22\}\$'\)/);
  assert.match(read("./domain/setup.ts"), /\^\[A-Za-z0-9\.-\]\{6,20\}\$/);
});
