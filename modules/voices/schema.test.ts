import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { commentStatuses, maxCommentBody, maxCommentName } from "./domain/comments.ts";

// No test database (docs/ROADMAP.md §5): these read the voices' section of supabase/schema.sql as text and guard the conventions of
// docs/CONVENTIONS.md §6 and the agreements with the domain.
const schema = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");
const start = schema.indexOf("-- Voces sagradas (modules/voices)");
assert.notEqual(start, -1, "falta la sección de las voces en schema.sql");
const voices = schema.slice(start);
const tables = [...voices.matchAll(/create table if not exists public\.(\w+) \(([\s\S]*?)\n\);/g)].map(([, name, body]) => ({ name, body }));
const functions = [...voices.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/g)].map(([, name, params, body]) => ({ name, params, body }));

test("las tablas de las voces son de un sitio y solo entra el servidor", () => {
  assert.deepEqual(tables.map(item => item.name).sort(), ["voice_comments", "voice_metrics"]);
  for (const { name, body } of tables) {
    assert.match(body, /site_id text not null references public\.sites \(id\)/, `${name}: site_id`);
    assert.ok(voices.includes(`alter table public.${name} enable row level security;`), `${name}: RLS`);
    assert.ok(voices.includes(`revoke all on public.${name} from anon, authenticated;`), `${name}: revoke`);
  }
});

test("los comentarios de la base aceptan lo mismo que el dominio", () => {
  const comments = tables.find(item => item.name === "voice_comments")?.body ?? "";
  assert.ok(comments.includes(`char_length(name) between 1 and ${maxCommentName}`), "nombre");
  assert.ok(comments.includes(`char_length(body) between 2 and ${maxCommentBody}`), "comentario");
  assert.ok(comments.includes(`status in (${commentStatuses.map(status => `'${status.id}'`).join(", ")})`), "estados");
});

test("las funciones reciben primero el sitio, leen solo el suyo y solo las llama el servidor", () => {
  assert.deepEqual(functions.map(fn => fn.name).sort(), ["voice_metrics_report", "voice_track"]);
  for (const { name, params, body } of functions) {
    assert.match(params, /^\s*p_site text/, `${name}: primer argumento`);
    if (/\bfrom public\./.test(body)) assert.match(body, /site_id = p_site/, `${name}: filtro por sitio`);
    assert.ok(voices.includes(`revoke execute on function public.${name}(`), `${name}: revoke`);
    assert.ok(voices.split("\n").some(line => line.startsWith(`grant execute on function public.${name}(`) && line.endsWith(") to service_role;")), `${name}: grant`);
  }
});

test("correr el archivo de nuevo no falla", () => {
  assert.doesNotMatch(voices, /create table public\./);
  assert.doesNotMatch(voices, /create (unique )?index (?!if not exists)/);
});
