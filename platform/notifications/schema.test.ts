import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// There is no test database (docs/ROADMAP.md §5): this reads the notices' section of supabase/schema.sql as text, like modules/sauna/schema.test.ts.

const schema = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");
const start = schema.indexOf("-- Panel notices (");
const end = schema.indexOf("-- Sauna (docs/SAUNA.md §5");
assert.ok(start !== -1 && end > start, "falta la sección de avisos antes de la del sauna");
const section = schema.slice(start, end);
const tables = [...section.matchAll(/create table if not exists public\.(\w+) \(([\s\S]*?)\n\);/g)].map(([, name, body]) => ({ name, body }));

test("están las tablas de los avisos", () => {
  assert.deepEqual(tables.map(table => table.name).sort(), ["panel_push_subscriptions", "panel_telegram_chats", "panel_telegram_links"]);
});

test("solo entra el servidor", () => {
  for (const { name } of tables) {
    assert.ok(section.includes(`alter table public.${name} enable row level security;`), `${name}: RLS`);
    assert.ok(section.includes(`revoke all on public.${name} from anon, authenticated;`), `${name}: revoke`);
  }
});

test("un mismo celular o chat no se guarda dos veces", () => {
  const body = (name: string) => tables.find(table => table.name === name)?.body ?? "";
  assert.match(body("panel_push_subscriptions"), /endpoint text not null unique/);
  assert.match(body("panel_telegram_chats"), /chat_id bigint not null unique/);
});

test("el código de vinculación se guarda solo como hash y vence", () => {
  const body = tables.find(table => table.name === "panel_telegram_links")?.body ?? "";
  assert.match(body, /code_hash text not null unique check \(code_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.match(body, /expires_at timestamptz not null/);
  assert.match(body, /used_at timestamptz,/);
  assert.doesNotMatch(body, /\bcode text\b/);
});

test("cada destino elige sus sitios, y vacío quiere decir todos", () => {
  for (const { name, body } of tables) assert.match(body, /site_ids text\[\] not null default '\{\}'/, name);
});

test("correr el archivo de nuevo no falla ni pisa datos", () => {
  assert.doesNotMatch(section, /create table public\./);
  assert.doesNotMatch(section, /create (unique )?index (?!if not exists)/);
  assert.doesNotMatch(section, /^insert into /m);
});
