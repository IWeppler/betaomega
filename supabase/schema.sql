-- Run once in the Supabase SQL Editor. Safe to run again.

create table if not exists public.app_data (
  key text primary key,
  data jsonb not null,
  revision integer not null default 0,
  updated_at timestamptz not null default now()
);

-- RLS on with no policies: only the server's secret key (which bypasses RLS) can read or write.
alter table public.app_data enable row level security;
revoke all on public.app_data from anon, authenticated;

-- Saves the catalog only if nobody else saved since `expected`. Returns the new catalog, or null on conflict.
create or replace function public.save_catalog(expected integer, payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_revision integer := expected + 1;
  result jsonb := jsonb_set(payload, '{revision}', to_jsonb(next_revision));
begin
  update public.app_data
     set data = result, revision = next_revision, updated_at = now()
   where key = 'catalog' and revision = expected;
  if found then return result; end if;

  insert into public.app_data (key, data, revision)
  values ('catalog', result, next_revision)
  on conflict (key) do nothing;
  if found then return result; end if;

  return null;
end;
$$;

-- Adds one consultation for a tonic and returns the whole usage map.
create or replace function public.increment_usage(tonic_id text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  insert into public.app_data as existing (key, data)
  values ('usage', jsonb_build_object(tonic_id, 1))
  on conflict (key) do update
    set data = jsonb_set(existing.data, array[tonic_id], to_jsonb(coalesce((existing.data ->> tonic_id)::integer, 0) + 1)),
        updated_at = now()
  returning data;
$$;

revoke execute on function public.save_catalog(integer, jsonb) from public, anon, authenticated;
revoke execute on function public.increment_usage(text) from public, anon, authenticated;
grant execute on function public.save_catalog(integer, jsonb) to service_role;
grant execute on function public.increment_usage(text) to service_role;

-- Private bucket for catalog photos; the app serves them through /api/images/<name>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Recipes of the recipe sites (lib/sites.ts, kind "recetas"). One row per recipe; ingredients and steps travel with it.
create table if not exists public.recipes (
  id uuid primary key,
  site_id text not null,
  slug text not null,
  title text not null,
  summary text not null default '',
  image text,
  categories text[] not null default '{}',
  servings text not null default '',
  prep_minutes integer check (prep_minutes >= 0),
  cook_minutes integer check (cook_minutes >= 0),
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  notes text not null default '',
  published boolean not null default false,
  -- The panel saves only if revision still matches what it read (lib/recipe-store.ts).
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);
create index if not exists recipes_site_published on public.recipes (site_id, published);
alter table public.recipes enable row level security;
revoke all on public.recipes from anon, authenticated;

-- First publication date. The public site lists recipes by it, so fixing an old recipe does not move it to the top.
-- The trigger fills it the first time a recipe is saved as published and never changes it afterwards.
alter table public.recipes add column if not exists published_at timestamptz;
update public.recipes set published_at = created_at where published and published_at is null;
create or replace function public.recipes_set_published_at() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.published and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
drop trigger if exists recipes_published_at on public.recipes;
create trigger recipes_published_at before insert or update on public.recipes
  for each row execute function public.recipes_set_published_at();

-- Views counter (most viewed recipes in the panel) and extra photos. The public site counts through increment_recipe_view.
alter table public.recipes add column if not exists views integer not null default 0;
alter table public.recipes add column if not exists images jsonb not null default '[]';
create or replace function public.increment_recipe_view(recipe_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.recipes set views = views + 1 where id = recipe_id and published;
$$;
revoke execute on function public.increment_recipe_view(uuid) from public, anon, authenticated;
grant execute on function public.increment_recipe_view(uuid) to service_role;

-- Taxonomy: when it is eaten (moments, fixed ids in lib/recipes.ts), nation and difficulty. `categories` stays as the recipe's type.
alter table public.recipes add column if not exists moments text[] not null default '{}';
alter table public.recipes add column if not exists cuisine text not null default '';
alter table public.recipes add column if not exists difficulty text check (difficulty in ('facil', 'media', 'dificil'));
create index if not exists recipes_moments on public.recipes using gin (moments);

-- The moment a category label stands for ("Postres", "Desayuno y merienda", "Almuerzos"), or null when it is a type.
create or replace function public.recipe_moment_of(label text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when k ~ '^(desayunos?|meriendas?)(\s*(/|y|e|,|-)\s*(desayunos?|meriendas?))?$' then 'desayuno-merienda'
    when k ~ '^(almuerzos?|cenas?)(\s*(/|y|e|,|-)\s*(almuerzos?|cenas?))?$' then 'almuerzo-cena'
    when k ~ '^postres?$' then 'postre'
    when k ~ '^(para )?cualquier momento$' then 'cualquier-momento'
  end
  from (select translate(lower(trim(label)), 'áéíóúü', 'aeiouu') as k) normalized;
$$;

-- One-time move: categories that are really moments become moments. Running it again finds nothing to move.
-- The revision goes up so a panel that had the old copy open cannot overwrite the move.
update public.recipes r
   set moments = (
         select coalesce(array_agg(m order by m), '{}')
           from (select unnest(r.moments) as m union select public.recipe_moment_of(c) from unnest(r.categories) c) found
          where m is not null),
       categories = array(
         select c from unnest(r.categories) with ordinality as u(c, n)
          where public.recipe_moment_of(c) is null
          order by n),
       revision = r.revision + 1
 where exists (select 1 from unnest(r.categories) c where public.recipe_moment_of(c) is not null);
-- Types are stored in capitals (the app does the same on save and on read). Running it again changes nothing.
update public.recipes r
   set categories = array(select upper(c) from unnest(r.categories) with ordinality as u(c, n) order by n)
 where exists (select 1 from unnest(r.categories) c where c <> upper(c));
-- "Cualquier momento" goes alone.
update public.recipes set moments = '{cualquier-momento}', revision = revision + 1
 where 'cualquier-momento' = any(moments) and cardinality(moments) > 1;

-- Reader comments on recipes (no ratings). They arrive as 'pending'; the panel approves or hides them and only 'approved' ones show on the site.
-- ip_hash is a keyed hash of the visitor's address (never the address itself), used to limit how many a person can send per hour.
create table if not exists public.recipe_comments (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  site_id text not null,
  name text not null default '' check (char_length(name) <= 60),
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  ip_hash text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists recipe_comments_recipe on public.recipe_comments (recipe_id, status, created_at desc);
create index if not exists recipe_comments_site on public.recipe_comments (site_id, status, created_at desc);
create index if not exists recipe_comments_ip on public.recipe_comments (ip_hash, created_at desc);
alter table public.recipe_comments enable row level security;
revoke all on public.recipe_comments from anon, authenticated;

-- Own metrics: one counter per site, recipe, kind, channel and day (so the table grows with the number of recipes, not of visits).
-- kind: page_view (any public page), recipe_view (a recipe's page), share (a share button). recipe_id is null for the site itself.
-- channel is only used by shares: 'nativo' (the phone's share sheet), 'whatsapp', 'copiar'; '' otherwise.
-- Days are Argentina's calendar days. `recipes.views` stops growing: it keeps the views counted before this table existed.
create table if not exists public.site_metrics (
  site_id text not null,
  recipe_id uuid references public.recipes (id) on delete cascade,
  kind text not null check (kind in ('page_view', 'recipe_view', 'share')),
  channel text not null default '' check (char_length(channel) <= 20),
  day date not null,
  count integer not null default 0
);
-- A primary key cannot hold nulls, so uniqueness goes through the nil uuid standing in for "the site itself".
create unique index if not exists site_metrics_unique on public.site_metrics (site_id, coalesce(recipe_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, channel, day);
create index if not exists site_metrics_day on public.site_metrics (site_id, day desc);
alter table public.site_metrics enable row level security;
revoke all on public.site_metrics from anon, authenticated;

-- Adds one to today's counter (creating it the first time) in a single statement.
create or replace function public.track_metric(p_site text, p_recipe uuid, p_kind text, p_channel text)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.site_metrics as m (site_id, recipe_id, kind, channel, day, count)
  values (p_site, p_recipe, p_kind, coalesce(p_channel, ''), (now() at time zone 'America/Argentina/Buenos_Aires')::date, 1)
  on conflict (site_id, coalesce(recipe_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, channel, day)
  do update set count = m.count + 1;
$$;

-- Everything the panel's Métricas page shows for the last p_days days (today included), in one call.
create or replace function public.metrics_report(p_site text, p_days integer)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select (now() at time zone 'America/Argentina/Buenos_Aires')::date as today, greatest(1, least(coalesce(p_days, 30), 365)) as days
  ),
  win as (
    select m.* from public.site_metrics m, bounds b where m.site_id = p_site and m.day > b.today - b.days
  )
  select jsonb_build_object(
    'today', (select today from bounds),
    'days', (select days from bounds),
    'totals', jsonb_build_object(
      'pageViews', coalesce((select sum(count) from win where kind = 'page_view'), 0),
      'recipeViews', coalesce((select sum(count) from win where kind = 'recipe_view'), 0),
      'shares', coalesce((select sum(count) from win where kind = 'share'), 0)),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'pageViews', d.pv, 'recipeViews', d.rv, 'shares', d.sh) order by d.day)
      from (select day,
                   coalesce(sum(count) filter (where kind = 'page_view'), 0) as pv,
                   coalesce(sum(count) filter (where kind = 'recipe_view'), 0) as rv,
                   coalesce(sum(count) filter (where kind = 'share'), 0) as sh
              from win group by day) d), '[]'::jsonb),
    'recipes', coalesce((select jsonb_agg(jsonb_build_object('id', r.recipe_id, 'views', r.rv, 'shares', r.sh))
      from (select recipe_id,
                   coalesce(sum(count) filter (where kind = 'recipe_view'), 0) as rv,
                   coalesce(sum(count) filter (where kind = 'share'), 0) as sh
              from win where recipe_id is not null group by recipe_id) r), '[]'::jsonb),
    'channels', coalesce((select jsonb_object_agg(c.channel, c.n)
      from (select channel, sum(count) as n from win where kind = 'share' and channel <> '' group by channel) c), '{}'::jsonb)
  );
$$;

-- Views of every recipe since the metrics began, to add to the old counter in the panel's lists.
create or replace function public.recipe_view_totals(p_site text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(t.recipe_id, t.n), '{}'::jsonb)
    from (select recipe_id, sum(count) as n from public.site_metrics
           where site_id = p_site and kind = 'recipe_view' and recipe_id is not null group by recipe_id) t;
$$;

revoke execute on function public.track_metric(text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.metrics_report(text, integer) from public, anon, authenticated;
revoke execute on function public.recipe_view_totals(text) from public, anon, authenticated;
grant execute on function public.track_metric(text, uuid, text, text) to service_role;
grant execute on function public.metrics_report(text, integer) to service_role;
grant execute on function public.recipe_view_totals(text) to service_role;


-- ---------------------------------------------------------------------------------------------------------------------
-- Site registry (lib/site-registry.ts). One row per public site; the panel and proxy.ts read it, with lib/sites.ts as fallback.
-- `kind` is not constrained here: the kinds are code (lib/sites.ts SiteKind), so a new kind needs no migration.
-- `options` holds what only some kinds use (product sites: wording, accent colour, icons).
create table if not exists public.sites (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,38}$'),
  kind text not null check (char_length(kind) between 1 and 30),
  name text not null check (char_length(name) between 1 and 80),
  url text not null,
  catalog_key text,
  panel_icon text,
  options jsonb not null default '{}',
  active boolean not null default true,
  -- Order of the panel's site switcher.
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sites enable row level security;
revoke all on public.sites from anon, authenticated;

-- One row per host, so a host can never belong to two sites. Hosts are stored without "www." or port, in lower case.
create table if not exists public.site_domains (
  domain text primary key check (domain = lower(domain) and domain !~ '^www\.' and domain !~ ':'),
  site_id text not null references public.sites (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists site_domains_site on public.site_domains (site_id);
alter table public.site_domains enable row level security;
revoke all on public.site_domains from anon, authenticated;

-- The sites that existed before this table. `do nothing`: running this again never overwrites what the panel changed.
insert into public.sites (id, kind, name, url, catalog_key, panel_icon, options, position) values
  ('nekurel', 'herboristeria', 'Ñekurel', 'https://nekurel.vercel.app', 'catalog', null, '{}', 0),
  ('comidasdelcielo', 'recetas', 'Comidas del cielo', 'https://comidasdelcielo.vercel.app', null, '/comidasdelcielo-icon.png', '{}', 1),
  ('purificacion', 'productos', 'Purificación', 'https://purificacion.vercel.app', null, '/purificacion-icon.png',
    '{"items":{"one":"agua","many":"aguas","feminine":true},"descriptionLabel":"Cómo se obtiene","application":true,"accent":"#0b6e99","icon":{"any":"/purificacion-icon.png","maskable":"/purificacion-icon-maskable.png"}}', 2),
  ('yakuchil', 'productos', 'Yakuchil', 'https://yakuchil.vercel.app', null, null,
    '{"items":{"one":"voz sagrada","many":"voces sagradas","feminine":true},"descriptionLabel":"Descripción","application":false,"accent":"#1f6f50"}', 3)
on conflict (id) do nothing;
insert into public.site_domains (domain, site_id) values
  ('nekurel.com', 'nekurel'), ('nekurel.vercel.app', 'nekurel'), ('nekurel.localhost', 'nekurel'),
  ('comidasdelcielo.vercel.app', 'comidasdelcielo'), ('comidasdelcielo.localhost', 'comidasdelcielo'),
  ('purificacion.vercel.app', 'purificacion'), ('purificacion.localhost', 'purificacion'),
  ('yakuchil.vercel.app', 'yakuchil'), ('yakuchil.localhost', 'yakuchil')
on conflict (domain) do nothing;

-- Tables that already carry a site_id now point at the registry. NOT VALID: new rows are checked, rows that exist are not,
-- so this never fails on old data. The block below validates them when there are no orphans.
do $$
declare t text;
begin
  foreach t in array array['recipes', 'recipe_comments', 'site_metrics'] loop
    if not exists (select 1 from pg_constraint where conname = t || '_site_fk') then
      execute format('alter table public.%I add constraint %I foreign key (site_id) references public.sites (id) not valid', t, t || '_site_fk');
    end if;
  end loop;
end $$;

-- Checks the rows that existed before those foreign keys. A table with orphan rows is left as it was and reported, so this script never fails on old data.
do $$
declare
  t text;
  orphans bigint;
begin
  foreach t in array array['recipes', 'recipe_comments', 'site_metrics'] loop
    if exists (select 1 from pg_constraint where conname = t || '_site_fk' and not convalidated) then
      execute format('select count(*) from public.%I r where r.site_id is not null and not exists (select 1 from public.sites s where s.id = r.site_id)', t) into orphans;
      if orphans = 0 then
        execute format('alter table public.%I validate constraint %I', t, t || '_site_fk');
      else
        raise warning '%: % filas con un site_id que no existe; la clave foránea queda sin validar.', t, orphans;
      end if;
    end if;
  end loop;
end $$;


-- ---------------------------------------------------------------------------------------------------------------------
-- Sauna (docs/SAUNA.md §5, modules/sauna/). Reservations with seats, deposits, codes and packs for sites of kind "sauna".
--
-- - Foreign keys between these tables include site_id, so a row can never point at another site's row, whatever the code does.
-- - Money is whole cents in bigint. Times are timestamptz; business days and weekdays are Buenos Aires ones.
-- - Rows that a panel must keep for the record (rooms, schedules, codes, plans) are deactivated, not deleted: their foreign keys refuse it.
-- - Uses of a code, seats and pack sessions are counted under a lock and never stored, so a lapsed hold gives them back with no scheduled task.
-- - Locks are always taken in this order, so two calls can never wait on each other: pack purchase → room → code → booking.

-- The fallback list of lib/sites.ts leaves this site out on purpose: it stays inactive until phase S6.
insert into public.sites (id, kind, name, url, catalog_key, panel_icon, options, active, position) values
  ('fropexio', 'sauna', 'Fropexio', 'https://fropexio.vercel.app', null, null, '{}', false, 4)
on conflict (id) do nothing;
insert into public.site_domains (domain, site_id) values
  ('fropexio.vercel.app', 'fropexio'), ('fropexio.localhost', 'fropexio')
on conflict (domain) do nothing;

-- 244 random bits from the database's strong generator. gen_random_bytes would need pgcrypto, which an empty search_path cannot see.
create or replace function public.sauna_new_token()
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
$$;
revoke execute on function public.sauna_new_token() from public, anon, authenticated;
grant execute on function public.sauna_new_token() to service_role;

-- A person who books. Generic on purpose: other kinds of site can use it. Anonymizing clears the name and the number and keeps the row, so
-- bookings and payments stay without identifying anyone (docs/SAUNA.md §9, point 12).
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites (id),
  name text not null,
  -- International form, digits only (cleanWhatsapp in modules/sauna/domain/customer.ts).
  whatsapp text check (whatsapp ~ '^[0-9]{8,15}$'),
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, id),
  unique (site_id, whatsapp),
  check (
    (anonymized_at is null and whatsapp is not null and char_length(name) between 1 and 80)
    or (anonymized_at is not null and whatsapp is null and name = '')
  )
);
alter table public.customers enable row level security;
revoke all on public.customers from anon, authenticated;

-- A site is a working sauna only if it has this row: sauna_reserve refuses any other site.
create table if not exists public.sauna_settings (
  site_id text primary key references public.sites (id),
  deposit_percent integer not null default 50 check (deposit_percent between 0 and 100),
  min_lead_minutes integer not null default 60 check (min_lead_minutes >= 0),
  max_advance_days integer not null default 60 check (max_advance_days >= 1),
  mp_hold_minutes integer not null default 15 check (mp_hold_minutes >= 1),
  transfer_hold_hours integer not null default 12 check (transfer_hold_hours >= 1),
  terms_version text not null default '1' check (char_length(terms_version) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sauna_settings enable row level security;
revoke all on public.sauna_settings from anon, authenticated;

create table if not exists public.sauna_rooms (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites (id),
  name text not null check (char_length(name) between 1 and 80),
  capacity integer not null check (capacity >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, id)
);
alter table public.sauna_rooms enable row level security;
revoke all on public.sauna_rooms from anon, authenticated;

-- The weekly template. Prices live per entry, which is how a price varies by day or time. A price is required only for the modes the entry offers.
create table if not exists public.sauna_schedules (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites (id),
  room_id uuid not null,
  -- 0 is Sunday, as extract(dow from …) gives it.
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  duration_minutes integer not null check (duration_minutes >= 1),
  mode text not null check (mode in ('shared', 'private', 'either')),
  capacity integer not null check (capacity >= 1),
  price_cents bigint check (price_cents >= 0),
  private_price_cents bigint check (private_price_cents >= 0),
  -- Null means the site's value.
  deposit_percent integer check (deposit_percent between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, id),
  unique (site_id, room_id, weekday, start_time),
  foreign key (site_id, room_id) references public.sauna_rooms (site_id, id),
  check (mode = 'private' or price_cents is not null),
  check (mode = 'shared' or private_price_cents is not null)
);
alter table public.sauna_schedules enable row level security;
revoke all on public.sauna_schedules from anon, authenticated;

-- Holidays, closures and "no more turns today". No room means every room. A closure stops new bookings and never cancels the ones already made.
create table if not exists public.sauna_closures (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites (id),
  room_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '' check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (site_id, room_id) references public.sauna_rooms (site_id, id),
  check (ends_at > starts_at)
);
create index if not exists sauna_closures_site on public.sauna_closures (site_id, starts_at, ends_at);
alter table public.sauna_closures enable row level security;
revoke all on public.sauna_closures from anon, authenticated;

-- A concrete turn. Created on first use, copying the template: later changes to the template do not alter a turn that already exists.
-- Its row is what sauna_reserve locks.
create table if not exists public.sauna_slots (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites (id),
  room_id uuid not null,
  schedule_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode text not null check (mode in ('shared', 'private', 'either')),
  capacity integer not null check (capacity >= 1),
  price_cents bigint check (price_cents >= 0),
  private_price_cents bigint check (private_price_cents >= 0),
  deposit_percent integer not null check (deposit_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, id),
  unique (site_id, room_id, starts_at),
  foreign key (site_id, room_id) references public.sauna_rooms (site_id, id),
  foreign key (site_id, schedule_id) references public.sauna_schedules (site_id, id),
  check (ends_at > starts_at),
  check (mode = 'private' or price_cents is not null),
  check (mode = 'shared' or private_price_cents is not null)
);
create index if not exists sauna_slots_time on public.sauna_slots (site_id, starts_at);
alter table public.sauna_slots enable row level security;
revoke all on public.sauna_slots from anon, authenticated;

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites (id),
  code text not null check (char_length(code) between 1 and 40 and code = btrim(code)),
  type text not null check (type in ('percent', 'fixed', 'no_deposit', 'free')),
  -- A percentage for "percent", cents for "fixed", zero otherwise.
  value bigint not null default 0,
  max_uses integer check (max_uses >= 1),
  max_uses_per_customer integer check (max_uses_per_customer >= 1),
  room_id uuid,
  schedule_id uuid,
  valid_from timestamptz,
  valid_until timestamptz,
  active boolean not null default true,
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, id),
  foreign key (site_id, room_id) references public.sauna_rooms (site_id, id),
  foreign key (site_id, schedule_id) references public.sauna_schedules (site_id, id),
  check (case type when 'percent' then value between 1 and 100 when 'fixed' then value >= 1 else value = 0 end),
  check (type <> 'free' or max_uses is not null)
);
create unique index if not exists discount_codes_text on public.discount_codes (site_id, lower(code));
alter table public.discount_codes enable row level security;
revoke all on public.discount_codes from anon, authenticated;

-- `rules` is the list of tiers of docs/SAUNA.md §7. Bookings keep a copy, so changing a policy never alters what was already promised.
create table if not exists public.cancellation_policies (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites (id),
  name text not null check (char_length(name) between 1 and 80),
  rules jsonb not null check (jsonb_typeof(rules) = 'array' and jsonb_array_length(rules) >= 1),
  active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cancellation_policies_site on public.cancellation_policies (site_id);
create unique index if not exists cancellation_policies_default on public.cancellation_policies (site_id) where is_default;
alter table public.cancellation_policies enable row level security;
revoke all on public.cancellation_policies from anon, authenticated;

create table if not exists public.sauna_pack_plans (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites (id),
  name text not null check (char_length(name) between 1 and 80),
  sessions integer not null check (sessions >= 1),
  price_cents bigint not null check (price_cents >= 0),
  valid_days integer not null check (valid_days >= 1),
  max_per_week integer not null check (max_per_week >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, id)
);
alter table public.sauna_pack_plans enable row level security;
revoke all on public.sauna_pack_plans from anon, authenticated;

-- A bought pack keeps its own copy of the plan's conditions, valid_days included: valid_until is only fixed when the payment is confirmed.
create table if not exists public.sauna_pack_purchases (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites (id),
  plan_id uuid not null,
  customer_id uuid not null,
  status text not null check (status in ('held', 'pending_transfer', 'active', 'expired', 'cancelled')),
  sessions integer not null check (sessions >= 1),
  price_cents bigint not null check (price_cents >= 0),
  valid_days integer not null check (valid_days >= 1),
  valid_until timestamptz,
  max_per_week integer not null check (max_per_week >= 1),
  policy_snapshot jsonb not null,
  terms_version text not null,
  terms_accepted_at timestamptz not null,
  token text not null unique default public.sauna_new_token(),
  expires_at timestamptz,
  needs_refund boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, id),
  foreign key (site_id, plan_id) references public.sauna_pack_plans (site_id, id),
  foreign key (site_id, customer_id) references public.customers (site_id, id),
  check (status <> 'active' or valid_until is not null),
  check (status not in ('held', 'pending_transfer') or expires_at is not null)
);
create index if not exists sauna_pack_purchases_customer on public.sauna_pack_purchases (site_id, customer_id);
alter table public.sauna_pack_purchases enable row level security;
revoke all on public.sauna_pack_purchases from anon, authenticated;

create table if not exists public.sauna_bookings (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites (id),
  slot_id uuid not null,
  customer_id uuid not null,
  seats integer not null check (seats >= 1),
  kind text not null check (kind in ('shared', 'private')),
  status text not null check (status in ('held', 'pending_transfer', 'confirmed', 'cancelled', 'expired', 'completed', 'no_show')),
  -- A copy of what applied when booking (docs/PATTERNS.md, pattern 13). price_cents is before the discount.
  price_cents bigint not null check (price_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  deposit_cents bigint not null default 0 check (deposit_cents >= 0),
  code_id uuid,
  pack_purchase_id uuid,
  pack_session_returned boolean not null default false,
  policy_snapshot jsonb not null,
  terms_version text not null,
  terms_accepted_at timestamptz not null,
  token text not null unique default public.sauna_new_token(),
  expires_at timestamptz,
  -- Money arrived with nothing to apply it to (a late payment with no seat, a wrong amount, a second payment). The panel lists it to return it by hand.
  needs_refund boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, id),
  foreign key (site_id, slot_id) references public.sauna_slots (site_id, id),
  foreign key (site_id, customer_id) references public.customers (site_id, id),
  foreign key (site_id, code_id) references public.discount_codes (site_id, id),
  foreign key (site_id, pack_purchase_id) references public.sauna_pack_purchases (site_id, id),
  check (discount_cents <= price_cents),
  check (deposit_cents <= price_cents - discount_cents),
  check (status not in ('held', 'pending_transfer') or expires_at is not null),
  check (code_id is null or pack_purchase_id is null),
  check (pack_purchase_id is not null or not pack_session_returned)
);
create index if not exists sauna_bookings_slot on public.sauna_bookings (site_id, slot_id, status);
create index if not exists sauna_bookings_customer on public.sauna_bookings (site_id, customer_id);
create index if not exists sauna_bookings_code on public.sauna_bookings (site_id, code_id) where code_id is not null;
create index if not exists sauna_bookings_pack on public.sauna_bookings (site_id, pack_purchase_id) where pack_purchase_id is not null;
create index if not exists sauna_bookings_refund on public.sauna_bookings (site_id) where needs_refund;
alter table public.sauna_bookings enable row level security;
revoke all on public.sauna_bookings from anon, authenticated;

-- Every status change of a booking or a pack: who, when, from what to what. from_status is null when it is created.
create table if not exists public.booking_events (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites (id),
  booking_id uuid,
  pack_purchase_id uuid,
  from_status text,
  to_status text not null,
  actor text not null check (char_length(actor) between 1 and 80),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  foreign key (site_id, booking_id) references public.sauna_bookings (site_id, id),
  foreign key (site_id, pack_purchase_id) references public.sauna_pack_purchases (site_id, id),
  check (num_nonnulls(booking_id, pack_purchase_id) = 1)
);
create index if not exists booking_events_booking on public.booking_events (site_id, booking_id, created_at) where booking_id is not null;
create index if not exists booking_events_pack on public.booking_events (site_id, pack_purchase_id, created_at) where pack_purchase_id is not null;
alter table public.booking_events enable row level security;
revoke all on public.booking_events from anon, authenticated;

-- The ledger (docs/PATTERNS.md, pattern 15): only money that really moved, always positive, `kind` says which way. No stored balance and no
-- editing, so a rejected payment is simply not a row. provider_ref makes a repeated notice a no-op; cash movements have none.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites (id),
  booking_id uuid,
  pack_purchase_id uuid,
  method text not null check (method in ('mercadopago', 'transfer', 'cash')),
  kind text not null check (kind in ('deposit', 'balance', 'pack', 'refund')),
  amount_cents bigint not null check (amount_cents >= 1),
  provider_ref text check (char_length(provider_ref) between 1 and 200),
  actor text not null check (char_length(actor) between 1 and 80),
  note text not null default '' check (char_length(note) <= 500),
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (site_id, provider_ref),
  foreign key (site_id, booking_id) references public.sauna_bookings (site_id, id),
  foreign key (site_id, pack_purchase_id) references public.sauna_pack_purchases (site_id, id),
  check (num_nonnulls(booking_id, pack_purchase_id) = 1),
  check (kind not in ('deposit', 'balance') or booking_id is not null),
  check (kind <> 'pack' or pack_purchase_id is not null)
);
create index if not exists payments_booking on public.payments (site_id, booking_id) where booking_id is not null;
create index if not exists payments_pack on public.payments (site_id, pack_purchase_id) where pack_purchase_id is not null;
alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;

-- Amounts cannot be changed or erased, not even by a bug. Only what can identify a person may change, because anonymizing has to clear it.
create or replace function public.sauna_payments_append_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or (to_jsonb(new) - 'raw' - 'note') is distinct from (to_jsonb(old) - 'raw' - 'note') then
    raise exception 'payments es un libro de movimientos: se agregan filas, no se editan ni se borran';
  end if;
  return new;
end $$;
revoke execute on function public.sauna_payments_append_only() from public, anon, authenticated;
drop trigger if exists payments_append_only on public.payments;
create trigger payments_append_only before update or delete on public.payments
  for each row execute function public.sauna_payments_append_only();

create or replace function public.sauna_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke execute on function public.sauna_touch_updated_at() from public, anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array['customers', 'sauna_settings', 'sauna_rooms', 'sauna_schedules', 'sauna_closures', 'sauna_slots', 'discount_codes',
                           'cancellation_policies', 'sauna_pack_plans', 'sauna_pack_purchases', 'sauna_bookings'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.sauna_touch_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- What Fropexio needs to work once it is activated. `do nothing` and the guard below: running this again never overwrites what the panel changed.
-- The deposit and the tiers are starting values the client replaces from the panel.
insert into public.sauna_settings (site_id) values ('fropexio') on conflict (site_id) do nothing;
insert into public.cancellation_policies (site_id, name, rules, is_default)
select 'fropexio', 'Política general',
       '[{"hoursBefore":48,"refundPercent":100},{"hoursBefore":24,"refundPercent":50},{"hoursBefore":0,"refundPercent":0}]'::jsonb, true
 where not exists (select 1 from public.cancellation_policies where site_id = 'fropexio');

-- The one rounding rule, the same integer formula as percentOf in platform/money/index.ts: exact halves round up.
create or replace function public.sauna_percent_of(p_cents bigint, p_percent integer)
returns bigint
language sql
immutable
security invoker
set search_path = ''
as $$
  select (p_cents * p_percent + 50) / 100;
$$;

-- Whether a booking still takes up its seats and its use of a code (isCurrent in modules/sauna/domain/booking.ts).
create or replace function public.sauna_is_current(p_status text, p_expires_at timestamptz)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_status in ('confirmed', 'completed', 'no_show')
      or (p_status in ('held', 'pending_transfer') and p_expires_at > now());
$$;

create or replace function public.sauna_is_closed(p_site text, p_room uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.sauna_closures c
     where c.site_id = p_site and (c.room_id is null or c.room_id = p_room)
       and c.starts_at < p_ends_at and c.ends_at > p_starts_at
  );
$$;

create or replace function public.sauna_reject(p_reason text)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object('ok', false, 'reason', p_reason);
$$;

-- Adds a refund to the ledger. Refunds are manual: this records money that was already returned outside the system. Partial refunds add up and can
-- never pass what was charged. p_ref is optional and makes a repeated request a no-op. Any status is valid: a payment with no seat stays expired.
create or replace function public.sauna_record_refund(
  p_site text,
  p_booking uuid,
  p_amount_cents bigint,
  p_method text,
  p_ref text,
  p_actor text,
  p_note text default ''
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking public.sauna_bookings;
  v_deposits bigint;
  v_charged bigint;
  v_refunded bigint;
begin
  if p_amount_cents is null or p_amount_cents < 1 or p_method is null or p_method not in ('mercadopago', 'transfer', 'cash')
     or p_actor is null or p_actor = '' then
    return public.sauna_reject('invalid_request');
  end if;
  select * into v_booking from public.sauna_bookings b where b.site_id = p_site and b.id = p_booking for update;
  if not found then return public.sauna_reject('not_found'); end if;
  if p_ref is not null and exists (select 1 from public.payments p where p.site_id = p_site and p.provider_ref = p_ref) then
    return jsonb_build_object('ok', true, 'outcome', 'duplicate', 'booking', to_jsonb(v_booking));
  end if;

  select coalesce(sum(p.amount_cents) filter (where p.kind = 'deposit'), 0)::bigint,
         coalesce(sum(p.amount_cents) filter (where p.kind <> 'refund'), 0)::bigint,
         coalesce(sum(p.amount_cents) filter (where p.kind = 'refund'), 0)::bigint
    into v_deposits, v_charged, v_refunded
    from public.payments p where p.site_id = p_site and p.booking_id = p_booking;
  if v_refunded + p_amount_cents > v_charged then return public.sauna_reject('refund_too_high'); end if;

  insert into public.payments (site_id, booking_id, method, kind, amount_cents, provider_ref, actor, note)
  values (p_site, p_booking, p_method, 'refund', p_amount_cents, p_ref, p_actor, coalesce(p_note, ''));

  -- The flag goes away once the money that had nothing to apply to is back: all of it, or what exceeds the deposit of a confirmed booking.
  update public.sauna_bookings b
     set needs_refund = false
   where b.site_id = p_site and b.id = p_booking and b.needs_refund
     and v_deposits - (v_refunded + p_amount_cents) <= case when b.status in ('confirmed', 'completed', 'no_show') then b.deposit_cents else 0 end
  returning * into v_booking;
  if not found then
    select * into v_booking from public.sauna_bookings b where b.site_id = p_site and b.id = p_booking;
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'recorded', 'booking', to_jsonb(v_booking));
end $$;

-- Cancels a booking, which frees its seats and its use of a code just by no longer counting. Always done by the person attending (docs/SAUNA.md §7):
-- the refund and whether a pack session comes back are their decision, and the panel only proposes them.
create or replace function public.sauna_cancel(
  p_site text,
  p_booking uuid,
  p_refund_cents bigint,
  p_refund_method text,
  p_return_session boolean,
  p_note text,
  p_actor text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking public.sauna_bookings;
  v_refund jsonb;
begin
  if p_actor is null or p_actor = '' or coalesce(p_refund_cents, 0) < 0 then return public.sauna_reject('invalid_request'); end if;
  select * into v_booking from public.sauna_bookings b where b.site_id = p_site and b.id = p_booking for update;
  if not found then return public.sauna_reject('not_found'); end if;
  if v_booking.status not in ('held', 'pending_transfer', 'confirmed') then return public.sauna_reject('invalid_status'); end if;
  if p_return_session is true and v_booking.pack_purchase_id is null then return public.sauna_reject('invalid_request'); end if;

  -- First, because it can refuse the amount, and then nothing must have changed.
  if coalesce(p_refund_cents, 0) > 0 then
    v_refund := public.sauna_record_refund(p_site, p_booking, p_refund_cents, p_refund_method, null, p_actor, coalesce(p_note, ''));
    if not (v_refund ->> 'ok')::boolean then return v_refund; end if;
  end if;

  insert into public.booking_events (site_id, booking_id, from_status, to_status, actor, note)
  values (p_site, p_booking, v_booking.status, 'cancelled', p_actor, coalesce(p_note, ''));

  update public.sauna_bookings
     set status = 'cancelled', pack_session_returned = p_return_session is true
   where site_id = p_site and id = p_booking
  returning * into v_booking;

  return jsonb_build_object('ok', true, 'booking', to_jsonb(v_booking));
end $$;

-- docs/SAUNA.md §9, point 12: clears who the person is and keeps what happened. Also the free text and the provider's answers tied to them, which can name
-- or identify them. Running it twice changes nothing more.
create or replace function public.sauna_anonymize_customer(p_site text, p_customer uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.customers
     set name = '', whatsapp = null, anonymized_at = coalesce(anonymized_at, now())
   where site_id = p_site and id = p_customer;
  if not found then return public.sauna_reject('not_found'); end if;

  update public.booking_events e
     set note = ''
   where e.site_id = p_site and e.note <> ''
     and (e.booking_id in (select b.id from public.sauna_bookings b where b.site_id = p_site and b.customer_id = p_customer)
       or e.pack_purchase_id in (select u.id from public.sauna_pack_purchases u where u.site_id = p_site and u.customer_id = p_customer));

  update public.payments m
     set note = '', raw = null
   where m.site_id = p_site and (m.note <> '' or m.raw is not null)
     and (m.booking_id in (select b.id from public.sauna_bookings b where b.site_id = p_site and b.customer_id = p_customer)
       or m.pack_purchase_id in (select u.id from public.sauna_pack_purchases u where u.site_id = p_site and u.customer_id = p_customer));

  update public.sauna_bookings b
     set origin_hash = ''
   where b.site_id = p_site and b.customer_id = p_customer and b.origin_hash <> '';

  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.sauna_percent_of(bigint, integer) from public, anon, authenticated;
revoke execute on function public.sauna_is_current(text, timestamptz) from public, anon, authenticated;
revoke execute on function public.sauna_is_closed(text, uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.sauna_reject(text) from public, anon, authenticated;
revoke execute on function public.sauna_record_refund(text, uuid, bigint, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.sauna_cancel(text, uuid, bigint, text, boolean, text, text) from public, anon, authenticated;
revoke execute on function public.sauna_anonymize_customer(text, uuid) from public, anon, authenticated;
grant execute on function public.sauna_percent_of(bigint, integer) to service_role;
grant execute on function public.sauna_is_current(text, timestamptz) to service_role;
grant execute on function public.sauna_is_closed(text, uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.sauna_reject(text) to service_role;
grant execute on function public.sauna_record_refund(text, uuid, bigint, text, text, text, text) to service_role;
grant execute on function public.sauna_cancel(text, uuid, bigint, text, boolean, text, text) to service_role;
grant execute on function public.sauna_anonymize_customer(text, uuid) to service_role;

-- Sauna, phase S2: what the panel and the public booking flow need on top of the model.
-- The number people write to from their booking page, and the optimistic revision of what two people can edit at once (docs/PATTERNS.md, pattern 4).
alter table public.sauna_settings add column if not exists contact_whatsapp text check (contact_whatsapp ~ '^[0-9]{8,15}$');
alter table public.sauna_settings add column if not exists revision integer not null default 1;
alter table public.sauna_rooms add column if not exists revision integer not null default 1;
alter table public.sauna_schedules add column if not exists revision integer not null default 1;
-- Keyed hash of the visitor's address (never the address), to limit how many bookings one origin can create. Anonymizing clears it.
alter table public.sauna_bookings add column if not exists origin_hash text not null default '';
create index if not exists sauna_bookings_origin on public.sauna_bookings (site_id, origin_hash, created_at) where origin_hash <> '';

-- The changes of status that move no money, made by whoever attends: confirming a hold by hand and marking attendance. A lapsed hold has lost its seat, so it
-- cannot be confirmed from here: only a payment brings it back, under the rule for late payments. Returns { ok: true, booking } or { ok: false, reason }.
create or replace function public.sauna_set_status(p_site text, p_booking uuid, p_to text, p_note text, p_actor text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking public.sauna_bookings;
  v_starts timestamptz;
begin
  if p_to is null or p_to not in ('confirmed', 'completed', 'no_show') or p_actor is null or p_actor = '' then
    return public.sauna_reject('invalid_request');
  end if;
  select * into v_booking from public.sauna_bookings b where b.site_id = p_site and b.id = p_booking for update;
  if not found then return public.sauna_reject('not_found'); end if;

  if p_to = 'confirmed' then
    if v_booking.status not in ('held', 'pending_transfer') or v_booking.expires_at <= now() then
      return public.sauna_reject('invalid_status');
    end if;
  else
    if v_booking.status <> 'confirmed' then return public.sauna_reject('invalid_status'); end if;
    select s.starts_at into v_starts from public.sauna_slots s where s.site_id = p_site and s.id = v_booking.slot_id;
    if v_starts > now() then return public.sauna_reject('not_started'); end if;
  end if;

  insert into public.booking_events (site_id, booking_id, from_status, to_status, actor, note)
  values (p_site, p_booking, v_booking.status, p_to, p_actor, coalesce(p_note, ''));

  update public.sauna_bookings b
     set status = p_to
   where b.site_id = p_site and b.id = p_booking
  returning * into v_booking;

  return jsonb_build_object('ok', true, 'booking', to_jsonb(v_booking));
end $$;
revoke execute on function public.sauna_set_status(text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.sauna_set_status(text, uuid, text, text, text) to service_role;

-- Sauna: turn types and time bands. A day has any number of bands, and each band offers one or more turn types (45 minutes, 60 minutes, each with its prices),
-- so a person can pick either at the same hour. Those turns overlap, which is why seats are counted by overlap under the lock of the room, not of the turn.
-- sauna_schedules, which held one row per turn, stays only as history: nothing reads it any more.
alter table public.sauna_settings add column if not exists start_step_minutes integer not null default 30 check (start_step_minutes between 5 and 240);

create table if not exists public.sauna_turn_types (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites (id),
  name text not null check (char_length(name) between 1 and 40),
  duration_minutes integer not null check (duration_minutes between 5 and 600),
  -- A null price means this type does not offer that kind of booking.
  price_cents bigint check (price_cents >= 0),
  private_price_cents bigint check (private_price_cents >= 0),
  -- Null means the site's value.
  deposit_percent integer check (deposit_percent between 0 and 100),
  active boolean not null default true,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, id),
  check (num_nonnulls(price_cents, private_price_cents) >= 1)
);
alter table public.sauna_turn_types enable row level security;
revoke all on public.sauna_turn_types from anon, authenticated;

create table if not exists public.sauna_time_bands (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites (id),
  room_id uuid not null,
  -- 0 is Sunday, as extract(dow from …) gives it.
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, id),
  foreign key (site_id, room_id) references public.sauna_rooms (site_id, id),
  check (end_time > start_time)
);
create index if not exists sauna_time_bands_day on public.sauna_time_bands (site_id, weekday, start_time);
alter table public.sauna_time_bands enable row level security;
revoke all on public.sauna_time_bands from anon, authenticated;

create table if not exists public.sauna_band_types (
  site_id text not null references public.sites (id),
  band_id uuid not null,
  turn_type_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (site_id, band_id, turn_type_id),
  foreign key (site_id, band_id) references public.sauna_time_bands (site_id, id) on delete cascade,
  foreign key (site_id, turn_type_id) references public.sauna_turn_types (site_id, id)
);
alter table public.sauna_band_types enable row level security;
revoke all on public.sauna_band_types from anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['sauna_turn_types', 'sauna_time_bands', 'sauna_band_types'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.sauna_touch_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- A turn is now a room, a start and a type: 45 and 60 minutes can begin at the same hour.
alter table public.sauna_slots add column if not exists turn_type_id uuid;
alter table public.sauna_slots drop constraint if exists sauna_slots_site_id_room_id_starts_at_key;
create unique index if not exists sauna_slots_turn on public.sauna_slots (site_id, room_id, starts_at, turn_type_id);
create index if not exists sauna_slots_overlap on public.sauna_slots (site_id, room_id, starts_at, ends_at);
-- Codes are restricted by type of turn from now on; schedule_id stops being read.
alter table public.discount_codes add column if not exists turn_type_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sauna_slots_turn_type_fk') then
    alter table public.sauna_slots add constraint sauna_slots_turn_type_fk foreign key (site_id, turn_type_id) references public.sauna_turn_types (site_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'discount_codes_turn_type_fk') then
    alter table public.discount_codes add constraint discount_codes_turn_type_fk foreign key (site_id, turn_type_id) references public.sauna_turn_types (site_id, id);
  end if;
end $$;

-- One-time move of what was loaded with the old screen: one type per distinct duration and prices, and one band per day and room. A site that already has types is left alone,
-- so running this again changes nothing.
do $$
declare
  v_site text;
  v_row record;
  v_day record;
  v_type uuid;
  v_band uuid;
  v_step integer;
begin
  for v_site in select distinct s.site_id from public.sauna_schedules s where s.active
                 and not exists (select 1 from public.sauna_turn_types t where t.site_id = s.site_id) loop
    for v_row in select distinct s.duration_minutes, s.price_cents, s.private_price_cents, s.deposit_percent
                   from public.sauna_schedules s where s.site_id = v_site and s.active loop
      insert into public.sauna_turn_types (site_id, name, duration_minutes, price_cents, private_price_cents, deposit_percent)
      values (v_site, 'Turno ' || v_row.duration_minutes || ' min', v_row.duration_minutes, v_row.price_cents, v_row.private_price_cents, v_row.deposit_percent)
      returning id into v_type;
      for v_day in select s.room_id, s.weekday, min(s.start_time) as first_start, max(s.start_time + make_interval(mins => s.duration_minutes)) as last_end
                     from public.sauna_schedules s
                    where s.site_id = v_site and s.active and s.duration_minutes = v_row.duration_minutes
                      and s.price_cents is not distinct from v_row.price_cents and s.private_price_cents is not distinct from v_row.private_price_cents
                      and s.deposit_percent is not distinct from v_row.deposit_percent
                    group by s.room_id, s.weekday loop
        insert into public.sauna_time_bands (site_id, room_id, weekday, start_time, end_time)
        values (v_site, v_day.room_id, v_day.weekday, v_day.first_start, v_day.last_end)
        returning id into v_band;
        insert into public.sauna_band_types (site_id, band_id, turn_type_id) values (v_site, v_band, v_type);
      end loop;
    end loop;
    -- Turns keep starting where they did: one after the other.
    select min(s.duration_minutes) into v_step from public.sauna_schedules s where s.site_id = v_site and s.active;
    update public.sauna_settings set start_step_minutes = least(greatest(v_step, 5), 240) where site_id = v_site;
  end loop;
end $$;

-- The seats a new booking has to fit next to, between two times, in a room. The room is too small to put strangers together, so one booking of any kind fills it: any booking
-- still in force that overlaps counts as every seat. Reserving, a late payment and the turns on offer all read this, which is what keeps the rule in one place.
-- Only trustworthy under the lock of the room's row.
drop function if exists public.sauna_seats_taken(text, uuid);
create or replace function public.sauna_peak_seats(p_site text, p_room uuid, p_from timestamptz, p_to timestamptz)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select case when exists (
    select 1
      from public.sauna_bookings b
      join public.sauna_slots s on s.site_id = b.site_id and s.id = b.slot_id
     where b.site_id = p_site and s.room_id = p_room and s.starts_at < p_to and s.ends_at > p_from
       and public.sauna_is_current(b.status, b.expires_at)
  ) then (select r.capacity::bigint from public.sauna_rooms r where r.site_id = p_site and r.id = p_room) else 0::bigint end;
$$;

-- Saves the whole week at once, or nothing: bands are replaced, so a failure in the middle cannot leave half a week. The revision of the settings is checked in the same
-- transaction that writes (docs/PATTERNS.md, pattern 4). A site without a room gets one here. p_bands is [{ weekday, from, to, typeIds }].
create or replace function public.sauna_save_week(p_site text, p_revision integer, p_capacity integer, p_step integer, p_bands jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room uuid;
  v_band jsonb;
  v_band_id uuid;
  v_type text;
begin
  update public.sauna_settings
     set start_step_minutes = p_step, revision = revision + 1
   where site_id = p_site and revision = p_revision;
  if not found then return public.sauna_reject('conflict'); end if;

  select r.id into v_room from public.sauna_rooms r where r.site_id = p_site and r.active order by r.created_at, r.id limit 1 for update;
  if v_room is null then
    insert into public.sauna_rooms (site_id, name, capacity) values (p_site, 'Sala', p_capacity) returning id into v_room;
  else
    update public.sauna_rooms r set capacity = p_capacity where r.site_id = p_site and r.id = v_room;
  end if;

  delete from public.sauna_time_bands b where b.site_id = p_site;
  for v_band in select value from jsonb_array_elements(p_bands) loop
    insert into public.sauna_time_bands (site_id, room_id, weekday, start_time, end_time)
    values (p_site, v_room, (v_band ->> 'weekday')::smallint, (v_band ->> 'from')::time, (v_band ->> 'to')::time)
    returning id into v_band_id;
    for v_type in select value from jsonb_array_elements_text(v_band -> 'typeIds') loop
      insert into public.sauna_band_types (site_id, band_id, turn_type_id) values (p_site, v_band_id, v_type::uuid);
    end loop;
  end loop;
  return jsonb_build_object('ok', true);
end $$;

-- Takes the seats of a turn: everything is decided here, under lock, and the browser only says what it wants (docs/PATTERNS.md, patterns 11 and 12).
-- With p_pack_token the person, the terms and the policy come from the purchase, and p_name, p_whatsapp and p_terms_accepted are ignored.
-- Returns { ok: true, booking } or { ok: false, reason }, with the reasons of modules/sauna/domain/rejections.ts.
drop function if exists public.sauna_reserve(text, uuid, timestamptz, text, integer, text, text, text, text, boolean);
create or replace function public.sauna_reserve(
  p_site text,
  p_room uuid,
  p_starts_at timestamptz,
  p_turn_type uuid,
  p_kind text,
  p_seats integer,
  p_name text,
  p_whatsapp text,
  p_code text,
  p_pack_token text,
  p_terms_accepted boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tz constant text := 'America/Argentina/Buenos_Aires';
  v_local timestamp := p_starts_at at time zone v_tz;
  v_start_minute integer := (extract(hour from v_local) * 60 + extract(minute from v_local))::integer;
  v_code_text text := nullif(btrim(coalesce(p_code, '')), '');
  v_name text := btrim(coalesce(p_name, ''));
  v_settings public.sauna_settings;
  v_room public.sauna_rooms;
  v_type public.sauna_turn_types;
  v_slot public.sauna_slots;
  v_code public.discount_codes;
  v_pack public.sauna_pack_purchases;
  v_booking public.sauna_bookings;
  v_ends timestamptz;
  v_deposit_percent integer;
  v_mode text;
  v_policy jsonb;
  v_terms_version text;
  v_terms_at timestamptz := now();
  v_customer uuid;
  v_seats integer;
  v_taken bigint;
  v_uses bigint;
  v_price bigint;
  v_discount bigint := 0;
  v_deposit bigint := 0;
  v_status text;
  v_expires timestamptz;
begin
  select * into v_settings from public.sauna_settings where site_id = p_site;
  if not found then return public.sauna_reject('not_configured'); end if;
  if p_kind is null or p_kind not in ('shared', 'private') or p_room is null or p_starts_at is null or p_turn_type is null then
    return public.sauna_reject('invalid_request');
  end if;

  if p_pack_token is not null then
    select * into v_pack from public.sauna_pack_purchases where site_id = p_site and token = p_pack_token for update;
    if not found then return public.sauna_reject('pack_not_found'); end if;
    if v_pack.status <> 'active' then return public.sauna_reject('pack_not_active'); end if;
    if v_code_text is not null then return public.sauna_reject('pack_with_code'); end if;
    if p_kind <> 'shared' or p_seats is distinct from 1 then return public.sauna_reject('pack_shared_only'); end if;
    if p_starts_at >= v_pack.valid_until then return public.sauna_reject('pack_expired'); end if;
    -- A session is spent unless it was given back: a no-show spends it, and so does a cancellation that kept it.
    if (select count(*) from public.sauna_bookings b
         where b.site_id = p_site and b.pack_purchase_id = v_pack.id and not b.pack_session_returned) >= v_pack.sessions then
      return public.sauna_reject('pack_no_sessions');
    end if;
    if (select count(*) from public.sauna_bookings b
          join public.sauna_slots s on s.site_id = b.site_id and s.id = b.slot_id
         where b.site_id = p_site and b.pack_purchase_id = v_pack.id and b.status not in ('cancelled', 'expired')
           and date_trunc('week', s.starts_at at time zone v_tz) = date_trunc('week', v_local)) >= v_pack.max_per_week then
      return public.sauna_reject('pack_week_limit');
    end if;
    v_customer := v_pack.customer_id;
    v_policy := v_pack.policy_snapshot;
    v_terms_version := v_pack.terms_version;
    v_terms_at := v_pack.terms_accepted_at;
  else
    if p_terms_accepted is not true then return public.sauna_reject('terms_not_accepted'); end if;
    if char_length(v_name) not between 1 and 80 or p_whatsapp is null or p_whatsapp !~ '^[0-9]{8,15}$' then
      return public.sauna_reject('invalid_customer');
    end if;
    select jsonb_build_object('name', c.name, 'rules', c.rules) into v_policy
      from public.cancellation_policies c
     where c.site_id = p_site and c.is_default and c.active;
    if v_policy is null then return public.sauna_reject('no_policy'); end if;
    v_terms_version := v_settings.terms_version;
    select c.id into v_customer from public.customers c where c.site_id = p_site and c.whatsapp = p_whatsapp;
  end if;

  if p_starts_at < now() + make_interval(mins => v_settings.min_lead_minutes) then return public.sauna_reject('too_soon'); end if;
  if p_starts_at > now() + make_interval(hours => v_settings.max_advance_days * 24) then return public.sauna_reject('too_far'); end if;

  -- Turns of different types overlap, so the lock that serializes who gets a seat is the room's.
  select * into v_room from public.sauna_rooms r where r.site_id = p_site and r.id = p_room and r.active for update;
  if not found then return public.sauna_reject('no_slot'); end if;

  -- The turn has to be one the week offers right now: that type, in a band of that day where it fits whole, at one of its starts.
  select * into v_type from public.sauna_turn_types t where t.site_id = p_site and t.id = p_turn_type and t.active;
  if not found then return public.sauna_reject('no_slot'); end if;
  if not exists (
    select 1 from public.sauna_time_bands b
      join public.sauna_band_types bt on bt.site_id = b.site_id and bt.band_id = b.id
     where b.site_id = p_site and b.room_id = p_room and bt.turn_type_id = p_turn_type
       and b.weekday = extract(dow from v_local)::smallint
       and extract(second from v_local) = 0
       and v_start_minute >= (extract(hour from b.start_time) * 60 + extract(minute from b.start_time))::integer
       and v_start_minute + v_type.duration_minutes <= (extract(hour from b.end_time) * 60 + extract(minute from b.end_time))::integer
       and (v_start_minute - (extract(hour from b.start_time) * 60 + extract(minute from b.start_time))::integer) % v_settings.start_step_minutes = 0
  ) then
    return public.sauna_reject('no_slot');
  end if;

  v_ends := p_starts_at + make_interval(mins => v_type.duration_minutes);
  if public.sauna_is_closed(p_site, p_room, p_starts_at, v_ends) then return public.sauna_reject('closed'); end if;
  if (p_kind = 'shared' and v_type.price_cents is null) or (p_kind = 'private' and v_type.private_price_cents is null) then
    return public.sauna_reject('kind_not_offered');
  end if;

  v_taken := public.sauna_peak_seats(p_site, p_room, p_starts_at, v_ends);
  if p_kind = 'private' then
    if v_taken > 0 then return public.sauna_reject('not_empty'); end if;
    v_seats := v_room.capacity; -- taking every seat is what keeps shared bookings out of this time
    v_price := v_type.private_price_cents;
  else
    if p_seats is null or p_seats < 1 then return public.sauna_reject('invalid_seats'); end if;
    if v_taken + p_seats > v_room.capacity then return public.sauna_reject('full'); end if;
    v_seats := p_seats;
    v_price := v_type.price_cents * p_seats;
  end if;

  v_deposit_percent := coalesce(v_type.deposit_percent, v_settings.deposit_percent);
  if v_pack.id is not null then
    v_price := 0; -- a session was paid with the pack: no charge and no deposit
  else
    if v_code_text is not null then
      select * into v_code from public.discount_codes c
       where c.site_id = p_site and lower(c.code) = lower(v_code_text) for update;
      if not found then return public.sauna_reject('code_not_found'); end if;
      if not v_code.active then return public.sauna_reject('code_inactive'); end if;
      if v_code.valid_from is not null and now() < v_code.valid_from then return public.sauna_reject('code_not_started'); end if;
      if v_code.valid_until is not null and now() > v_code.valid_until then return public.sauna_reject('code_expired'); end if;
      if v_code.room_id is not null and v_code.room_id <> p_room then return public.sauna_reject('code_wrong_slot'); end if;
      if v_code.turn_type_id is not null and v_code.turn_type_id <> p_turn_type then return public.sauna_reject('code_wrong_slot'); end if;
      if v_code.max_uses is not null then
        select count(*) into v_uses from public.sauna_bookings b
         where b.site_id = p_site and b.code_id = v_code.id and public.sauna_is_current(b.status, b.expires_at);
        if v_uses >= v_code.max_uses then return public.sauna_reject('code_exhausted'); end if;
      end if;
      if v_code.max_uses_per_customer is not null and v_customer is not null then
        select count(*) into v_uses from public.sauna_bookings b
         where b.site_id = p_site and b.code_id = v_code.id and b.customer_id = v_customer and public.sauna_is_current(b.status, b.expires_at);
        if v_uses >= v_code.max_uses_per_customer then return public.sauna_reject('code_customer_limit'); end if;
      end if;
      v_discount := case v_code.type
        when 'percent' then public.sauna_percent_of(v_price, v_code.value::integer)
        when 'fixed' then least(v_code.value, v_price)
        when 'free' then v_price
        else 0
      end;
    end if;
    -- The deposit comes from the discounted price. "no_deposit" keeps the price and charges nothing now.
    if v_code.type is distinct from 'no_deposit' then
      v_deposit := public.sauna_percent_of(v_price - v_discount, v_deposit_percent);
    end if;
  end if;

  -- The row of this turn, created on first use. The booking keeps its own copy of the amounts, so the prices here are only a record.
  v_mode := case when v_type.price_cents is null then 'private' when v_type.private_price_cents is null then 'shared' else 'either' end;
  insert into public.sauna_slots (site_id, room_id, turn_type_id, starts_at, ends_at, mode, capacity, price_cents, private_price_cents, deposit_percent)
  values (p_site, p_room, p_turn_type, p_starts_at, v_ends, v_mode, v_room.capacity, v_type.price_cents, v_type.private_price_cents, v_deposit_percent)
  on conflict (site_id, room_id, starts_at, turn_type_id) do nothing;
  select * into v_slot from public.sauna_slots s where s.site_id = p_site and s.room_id = p_room and s.starts_at = p_starts_at and s.turn_type_id = p_turn_type;

  -- Only now, so a refused request leaves no personal data behind. An existing person keeps their name: the number is not verified, so someone
  -- else's request must not rename them.
  if v_customer is null then
    insert into public.customers (site_id, name, whatsapp) values (p_site, v_name, p_whatsapp)
    on conflict (site_id, whatsapp) do nothing
    returning id into v_customer;
    if v_customer is null then
      select c.id into v_customer from public.customers c where c.site_id = p_site and c.whatsapp = p_whatsapp;
    end if;
  end if;

  if v_deposit = 0 then
    v_status := 'confirmed';
  else
    v_status := 'held';
    v_expires := least(now() + make_interval(mins => v_settings.mp_hold_minutes), p_starts_at);
  end if;

  insert into public.sauna_bookings (site_id, slot_id, customer_id, seats, kind, status, price_cents, discount_cents, deposit_cents,
                                     code_id, pack_purchase_id, policy_snapshot, terms_version, terms_accepted_at, expires_at)
  values (p_site, v_slot.id, v_customer, v_seats, p_kind, v_status, v_price, v_discount, v_deposit,
          v_code.id, v_pack.id, v_policy, v_terms_version, v_terms_at, v_expires)
  returning * into v_booking;

  insert into public.booking_events (site_id, booking_id, from_status, to_status, actor)
  values (p_site, v_booking.id, null, v_status, 'sitio');

  return jsonb_build_object('ok', true, 'booking', to_jsonb(v_booking));
end $$;

-- Records a payment of the deposit and applies it, in the order of settlePayment (modules/sauna/domain/payments.ts). The money is written first
-- because it did arrive; the same provider_ref again changes nothing. Returns { ok: true, outcome, booking } or { ok: false, reason }.
create or replace function public.sauna_confirm_payment(
  p_site text,
  p_booking uuid,
  p_provider_ref text,
  p_amount_cents bigint,
  p_method text,
  p_actor text,
  p_raw jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_slot public.sauna_slots;
  v_room public.sauna_rooms;
  v_booking public.sauna_bookings;
  v_paid uuid;
  v_lapsed boolean;
  v_outcome text;
  v_to text;
begin
  if p_provider_ref is null or p_provider_ref = '' or p_amount_cents is null or p_amount_cents < 1
     or p_method is null or p_method not in ('mercadopago', 'transfer', 'cash') or p_actor is null or p_actor = '' then
    return public.sauna_reject('invalid_request');
  end if;

  -- The room is locked before the booking, as in sauna_reserve: a late payment competes for its seat with new bookings.
  select s.* into v_slot from public.sauna_bookings b join public.sauna_slots s on s.site_id = b.site_id and s.id = b.slot_id where b.site_id = p_site and b.id = p_booking;
  if not found then return public.sauna_reject('not_found'); end if;
  select * into v_room from public.sauna_rooms r where r.site_id = p_site and r.id = v_slot.room_id for update;
  select * into v_booking from public.sauna_bookings b where b.site_id = p_site and b.id = p_booking for update;

  insert into public.payments (site_id, booking_id, method, kind, amount_cents, provider_ref, actor, raw)
  values (p_site, p_booking, p_method, 'deposit', p_amount_cents, p_provider_ref, p_actor, p_raw)
  on conflict (site_id, provider_ref) do nothing
  returning id into v_paid;
  if v_paid is null then
    return jsonb_build_object('ok', true, 'outcome', 'duplicate', 'booking', to_jsonb(v_booking));
  end if;

  if v_booking.status not in ('held', 'pending_transfer', 'expired') then
    v_outcome := 'unapplied';
  elsif p_amount_cents <> v_booking.deposit_cents then
    v_outcome := 'amount_mismatch';
  else
    v_lapsed := v_booking.status = 'expired' or v_booking.expires_at <= now();
    if not v_lapsed then
      v_outcome := 'confirmed';
    elsif v_slot.starts_at > now()
      and not public.sauna_is_closed(p_site, v_slot.room_id, v_slot.starts_at, v_slot.ends_at)
      and public.sauna_peak_seats(p_site, v_slot.room_id, v_slot.starts_at, v_slot.ends_at) + v_booking.seats <= v_room.capacity then
      v_outcome := 'late_confirmed'; -- keeps the stored price even if its code has run out since
    else
      v_outcome := 'no_seat';
    end if;
  end if;

  v_to := case
    when v_outcome in ('confirmed', 'late_confirmed') then 'confirmed'
    when v_outcome = 'no_seat' then 'expired'
    else v_booking.status
  end;
  if v_to <> v_booking.status then
    insert into public.booking_events (site_id, booking_id, from_status, to_status, actor, note)
    values (p_site, p_booking, v_booking.status, v_to, p_actor, v_outcome);
  end if;

  update public.sauna_bookings
     set status = v_to,
         needs_refund = needs_refund or v_outcome in ('no_seat', 'amount_mismatch', 'unapplied')
   where site_id = p_site and id = p_booking
  returning * into v_booking;

  return jsonb_build_object('ok', true, 'outcome', v_outcome, 'booking', to_jsonb(v_booking));
end $$;

-- Every turn the week offers in a date range (Buenos Aires days, at most 93): one row per start and type. Read-only and without locks: what it says is a preview, and
-- sauna_reserve decides again.
drop function if exists public.sauna_availability(text, date, date);
create or replace function public.sauna_availability(p_site text, p_from date, p_to date)
returns table (
  room_id uuid,
  turn_type_id uuid,
  type_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  free_seats integer,
  price_cents bigint,
  private_price_cents bigint,
  deposit_percent integer,
  closed boolean,
  bookable boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with config as (
    select st.deposit_percent, st.min_lead_minutes, st.max_advance_days, st.start_step_minutes, least(p_to, p_from + 92) as last_day
      from public.sauna_settings st where st.site_id = p_site
  ),
  turns as (
    select r.id as room_id, r.capacity, t.id as turn_type_id, t.name as type_name, t.price_cents, t.private_price_cents,
           coalesce(t.deposit_percent, c.deposit_percent) as deposit_percent, t.duration_minutes,
           (series.moment at time zone 'America/Argentina/Buenos_Aires') as starts_at
      from config c
      cross join lateral generate_series(p_from::timestamp, c.last_day::timestamp, interval '1 day') as dates(day)
      join public.sauna_time_bands b on b.site_id = p_site and b.weekday = extract(dow from dates.day)::smallint
      join public.sauna_rooms r on r.site_id = b.site_id and r.id = b.room_id and r.active
      join public.sauna_band_types bt on bt.site_id = b.site_id and bt.band_id = b.id
      join public.sauna_turn_types t on t.site_id = bt.site_id and t.id = bt.turn_type_id and t.active
      cross join lateral generate_series(
        dates.day::date + b.start_time,
        dates.day::date + b.end_time - make_interval(mins => t.duration_minutes),
        make_interval(mins => c.start_step_minutes)
      ) as series(moment)
  ),
  counted as (
    select u.*, u.starts_at + make_interval(mins => u.duration_minutes) as ends_at,
           greatest(u.capacity - public.sauna_peak_seats(p_site, u.room_id, u.starts_at, u.starts_at + make_interval(mins => u.duration_minutes)), 0)::integer as free_seats,
           public.sauna_is_closed(p_site, u.room_id, u.starts_at, u.starts_at + make_interval(mins => u.duration_minutes)) as closed
      from turns u
  )
  select n.room_id, n.turn_type_id, n.type_name, n.starts_at, n.ends_at, n.capacity, n.free_seats,
         n.price_cents, n.private_price_cents, n.deposit_percent, n.closed,
         not n.closed and n.free_seats > 0
           and n.starts_at >= now() + make_interval(mins => c.min_lead_minutes)
           and n.starts_at <= now() + make_interval(hours => c.max_advance_days * 24) as bookable
    from counted n, config c
   order by n.starts_at, n.duration_minutes;
$$;

revoke execute on function public.sauna_peak_seats(text, uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.sauna_save_week(text, integer, integer, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.sauna_reserve(text, uuid, timestamptz, uuid, text, integer, text, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.sauna_confirm_payment(text, uuid, text, bigint, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.sauna_availability(text, date, date) from public, anon, authenticated;
grant execute on function public.sauna_peak_seats(text, uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.sauna_save_week(text, integer, integer, integer, jsonb) to service_role;
grant execute on function public.sauna_reserve(text, uuid, timestamptz, uuid, text, integer, text, text, text, text, boolean) to service_role;
grant execute on function public.sauna_confirm_payment(text, uuid, text, bigint, text, text, jsonb) to service_role;
grant execute on function public.sauna_availability(text, date, date) to service_role;


-- S2d: manual booking. No customer acceptance is inferred from an operator's action.
alter table public.sauna_bookings add column if not exists origin text not null default 'public';
alter table public.sauna_bookings add column if not exists manual_request_id uuid;
alter table public.sauna_bookings alter column terms_accepted_at drop not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.sauna_bookings'::regclass and conname = 'sauna_bookings_origin_terms') then
    alter table public.sauna_bookings add constraint sauna_bookings_origin_terms check (
      (origin = 'public' and terms_accepted_at is not null and manual_request_id is null)
      or (origin = 'panel' and terms_accepted_at is null and manual_request_id is not null)
    ) not valid;
  end if;
end $$;
create unique index if not exists sauna_bookings_manual_request on public.sauna_bookings (site_id, manual_request_id) where manual_request_id is not null;

-- Shared rules. Only the server's two wrappers decide whether the caller is public or panel.
create or replace function public.sauna_reserve_core(
  p_site text,
  p_room uuid,
  p_starts_at timestamptz,
  p_turn_type uuid,
  p_kind text,
  p_seats integer,
  p_name text,
  p_whatsapp text,
  p_code text,
  p_pack_token text,
  p_terms_accepted boolean,
  p_manual boolean,
  p_request_id uuid,
  p_expected_price bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tz constant text := 'America/Argentina/Buenos_Aires';
  v_local timestamp := p_starts_at at time zone v_tz;
  v_start_minute integer := (extract(hour from v_local) * 60 + extract(minute from v_local))::integer;
  v_code_text text := nullif(btrim(coalesce(p_code, '')), '');
  v_name text := btrim(coalesce(p_name, ''));
  v_settings public.sauna_settings;
  v_room public.sauna_rooms;
  v_type public.sauna_turn_types;
  v_slot public.sauna_slots;
  v_code public.discount_codes;
  v_pack public.sauna_pack_purchases;
  v_booking public.sauna_bookings;
  v_ends timestamptz;
  v_deposit_percent integer;
  v_mode text;
  v_policy jsonb;
  v_terms_version text;
  v_terms_at timestamptz := case when p_manual then null else now() end;
  v_customer uuid;
  v_seats integer;
  v_taken bigint;
  v_uses bigint;
  v_price bigint;
  v_discount bigint := 0;
  v_deposit bigint := 0;
  v_status text;
  v_expires timestamptz;
begin
  if p_manual is null or (p_manual and (p_request_id is null or p_expected_price is null or p_expected_price < 0
    or p_pack_token is not null or v_code_text is not null or p_seats is distinct from 1 or p_terms_accepted is distinct from false)) then
    return public.sauna_reject('invalid_request');
  end if;
  select * into v_settings from public.sauna_settings where site_id = p_site for share;
  if not found then return public.sauna_reject('not_configured'); end if;
  if p_kind is null or p_kind not in ('shared', 'private') or p_room is null or p_starts_at is null or p_turn_type is null then
    return public.sauna_reject('invalid_request');
  end if;

  if p_pack_token is not null then
    select * into v_pack from public.sauna_pack_purchases where site_id = p_site and token = p_pack_token for update;
    if not found then return public.sauna_reject('pack_not_found'); end if;
    if v_pack.status <> 'active' then return public.sauna_reject('pack_not_active'); end if;
    if v_code_text is not null then return public.sauna_reject('pack_with_code'); end if;
    if p_kind <> 'shared' or p_seats is distinct from 1 then return public.sauna_reject('pack_shared_only'); end if;
    if p_starts_at >= v_pack.valid_until then return public.sauna_reject('pack_expired'); end if;
    -- A session is spent unless it was given back: a no-show spends it, and so does a cancellation that kept it.
    if (select count(*) from public.sauna_bookings b
         where b.site_id = p_site and b.pack_purchase_id = v_pack.id and not b.pack_session_returned) >= v_pack.sessions then
      return public.sauna_reject('pack_no_sessions');
    end if;
    if (select count(*) from public.sauna_bookings b
          join public.sauna_slots s on s.site_id = b.site_id and s.id = b.slot_id
         where b.site_id = p_site and b.pack_purchase_id = v_pack.id and b.status not in ('cancelled', 'expired')
           and date_trunc('week', s.starts_at at time zone v_tz) = date_trunc('week', v_local)) >= v_pack.max_per_week then
      return public.sauna_reject('pack_week_limit');
    end if;
    v_customer := v_pack.customer_id;
    v_policy := v_pack.policy_snapshot;
    v_terms_version := v_pack.terms_version;
    v_terms_at := v_pack.terms_accepted_at;
  else
    if not p_manual and p_terms_accepted is not true then return public.sauna_reject('terms_not_accepted'); end if;
    if (p_manual and p_whatsapp !~ '^549[0-9]{10}$') or char_length(v_name) not between 1 and 80 or p_whatsapp is null or p_whatsapp !~ '^[0-9]{8,15}$' then
      return public.sauna_reject('invalid_customer');
    end if;
    select jsonb_build_object('name', c.name, 'rules', c.rules) into v_policy
      from public.cancellation_policies c
     where c.site_id = p_site and c.is_default and c.active;
    if v_policy is null then return public.sauna_reject('no_policy'); end if;
    v_terms_version := v_settings.terms_version;
    select c.id into v_customer from public.customers c where c.site_id = p_site and c.whatsapp = p_whatsapp;
  end if;

  if (p_manual and p_starts_at <= now()) or (not p_manual and p_starts_at < now() + make_interval(mins => v_settings.min_lead_minutes)) then return public.sauna_reject('too_soon'); end if;
  if p_starts_at > now() + make_interval(hours => v_settings.max_advance_days * 24) then return public.sauna_reject('too_far'); end if;

  -- Turns of different types overlap, so the lock that serializes who gets a seat is the room's.
  select * into v_room from public.sauna_rooms r where r.site_id = p_site and r.id = p_room and r.active for update;
  if not found then return public.sauna_reject('no_slot'); end if;

  -- The turn has to be one the week offers right now: that type, in a band of that day where it fits whole, at one of its starts.
  select * into v_type from public.sauna_turn_types t where t.site_id = p_site and t.id = p_turn_type and t.active for share;
  if not found then return public.sauna_reject('no_slot'); end if;
  if not exists (
    select 1 from public.sauna_time_bands b
      join public.sauna_band_types bt on bt.site_id = b.site_id and bt.band_id = b.id
     where b.site_id = p_site and b.room_id = p_room and bt.turn_type_id = p_turn_type
       and b.weekday = extract(dow from v_local)::smallint
       and extract(second from v_local) = 0
       and v_start_minute >= (extract(hour from b.start_time) * 60 + extract(minute from b.start_time))::integer
       and v_start_minute + v_type.duration_minutes <= (extract(hour from b.end_time) * 60 + extract(minute from b.end_time))::integer
       and (v_start_minute - (extract(hour from b.start_time) * 60 + extract(minute from b.start_time))::integer) % v_settings.start_step_minutes = 0
  ) then
    return public.sauna_reject('no_slot');
  end if;

  v_ends := p_starts_at + make_interval(mins => v_type.duration_minutes);
  if public.sauna_is_closed(p_site, p_room, p_starts_at, v_ends) then return public.sauna_reject('closed'); end if;
  if (p_kind = 'shared' and v_type.price_cents is null) or (p_kind = 'private' and v_type.private_price_cents is null) then
    return public.sauna_reject('kind_not_offered');
  end if;

  v_taken := public.sauna_peak_seats(p_site, p_room, p_starts_at, v_ends);
  if p_kind = 'private' then
    if v_taken > 0 then return public.sauna_reject('not_empty'); end if;
    v_seats := v_room.capacity; -- taking every seat is what keeps shared bookings out of this time
    v_price := v_type.private_price_cents;
  else
    if p_seats is null or p_seats < 1 then return public.sauna_reject('invalid_seats'); end if;
    if v_taken + p_seats > v_room.capacity then return public.sauna_reject('full'); end if;
    v_seats := p_seats;
    v_price := v_type.price_cents * p_seats;
  end if;

  v_deposit_percent := coalesce(v_type.deposit_percent, v_settings.deposit_percent);
  if v_pack.id is not null then
    v_price := 0; -- a session was paid with the pack: no charge and no deposit
  else
    if v_code_text is not null then
      select * into v_code from public.discount_codes c
       where c.site_id = p_site and lower(c.code) = lower(v_code_text) for update;
      if not found then return public.sauna_reject('code_not_found'); end if;
      if not v_code.active then return public.sauna_reject('code_inactive'); end if;
      if v_code.valid_from is not null and now() < v_code.valid_from then return public.sauna_reject('code_not_started'); end if;
      if v_code.valid_until is not null and now() > v_code.valid_until then return public.sauna_reject('code_expired'); end if;
      if v_code.room_id is not null and v_code.room_id <> p_room then return public.sauna_reject('code_wrong_slot'); end if;
      if v_code.turn_type_id is not null and v_code.turn_type_id <> p_turn_type then return public.sauna_reject('code_wrong_slot'); end if;
      if v_code.max_uses is not null then
        select count(*) into v_uses from public.sauna_bookings b
         where b.site_id = p_site and b.code_id = v_code.id and public.sauna_is_current(b.status, b.expires_at);
        if v_uses >= v_code.max_uses then return public.sauna_reject('code_exhausted'); end if;
      end if;
      if v_code.max_uses_per_customer is not null and v_customer is not null then
        select count(*) into v_uses from public.sauna_bookings b
         where b.site_id = p_site and b.code_id = v_code.id and b.customer_id = v_customer and public.sauna_is_current(b.status, b.expires_at);
        if v_uses >= v_code.max_uses_per_customer then return public.sauna_reject('code_customer_limit'); end if;
      end if;
      v_discount := case v_code.type
        when 'percent' then public.sauna_percent_of(v_price, v_code.value::integer)
        when 'fixed' then least(v_code.value, v_price)
        when 'free' then v_price
        else 0
      end;
    end if;
    -- The deposit comes from the discounted price. "no_deposit" keeps the price and charges nothing now.
    if not p_manual and v_code.type is distinct from 'no_deposit' then
      v_deposit := public.sauna_percent_of(v_price - v_discount, v_deposit_percent);
    end if;
  end if;

  if p_manual and p_starts_at <= clock_timestamp() then return public.sauna_reject('too_soon'); end if;
  if p_manual and v_price is distinct from p_expected_price then return public.sauna_reject('invalid_request'); end if;

  -- The row of this turn, created on first use. The booking keeps its own copy of the amounts, so the prices here are only a record.
  v_mode := case when v_type.price_cents is null then 'private' when v_type.private_price_cents is null then 'shared' else 'either' end;
  insert into public.sauna_slots (site_id, room_id, turn_type_id, starts_at, ends_at, mode, capacity, price_cents, private_price_cents, deposit_percent)
  values (p_site, p_room, p_turn_type, p_starts_at, v_ends, v_mode, v_room.capacity, v_type.price_cents, v_type.private_price_cents, v_deposit_percent)
  on conflict (site_id, room_id, starts_at, turn_type_id) do nothing;
  select * into v_slot from public.sauna_slots s where s.site_id = p_site and s.room_id = p_room and s.starts_at = p_starts_at and s.turn_type_id = p_turn_type;

  -- Only now, so a refused request leaves no personal data behind. An existing person keeps their name: the number is not verified, so someone
  -- else's request must not rename them.
  if v_customer is null then
    insert into public.customers (site_id, name, whatsapp) values (p_site, v_name, p_whatsapp)
    on conflict (site_id, whatsapp) do nothing
    returning id into v_customer;
    if v_customer is null then
      select c.id into v_customer from public.customers c where c.site_id = p_site and c.whatsapp = p_whatsapp;
    end if;
  end if;

  if v_deposit = 0 then
    v_status := 'confirmed';
  else
    v_status := 'held';
    v_expires := least(now() + make_interval(mins => v_settings.mp_hold_minutes), p_starts_at);
  end if;

  insert into public.sauna_bookings (site_id, slot_id, customer_id, seats, kind, status, price_cents, discount_cents, deposit_cents,
                                     code_id, pack_purchase_id, policy_snapshot, terms_version, terms_accepted_at, expires_at, origin, manual_request_id)
  values (p_site, v_slot.id, v_customer, v_seats, p_kind, v_status, v_price, v_discount, v_deposit,
          v_code.id, v_pack.id, v_policy, v_terms_version, v_terms_at, v_expires, case when p_manual then 'panel' else 'public' end, case when p_manual then p_request_id end)
  returning * into v_booking;

  insert into public.booking_events (site_id, booking_id, from_status, to_status, actor, note)
  values (p_site, v_booking.id, null, v_status, case when p_manual then 'panel' else 'sitio' end,
          case when p_manual then 'Manual booking; customer terms acceptance pending' else '' end);

  return jsonb_build_object('ok', true, 'booking', to_jsonb(v_booking));
end $$;

create or replace function public.sauna_reserve(
  p_site text,
  p_room uuid,
  p_starts_at timestamptz,
  p_turn_type uuid,
  p_kind text,
  p_seats integer,
  p_name text,
  p_whatsapp text,
  p_code text,
  p_pack_token text,
  p_terms_accepted boolean
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select public.sauna_reserve_core(p_site, p_room, p_starts_at, p_turn_type, p_kind, p_seats, p_name, p_whatsapp, p_code, p_pack_token, p_terms_accepted, false, null, null);
$$;

-- A transaction-scoped request lock serializes retries, even if a changed payload names another room.
-- It precedes the room lock and is never taken by the public reservation flow.
create or replace function public.sauna_reserve_manual(
  p_site text, p_room uuid, p_starts_at timestamptz, p_turn_type uuid, p_kind text,
  p_name text, p_whatsapp text, p_request_id uuid, p_expected_price bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking public.sauna_bookings;
begin
  if p_site is null or p_request_id is null or p_expected_price is null or p_expected_price < 0 then
    return public.sauna_reject('invalid_request');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_site || ':' || p_request_id::text, 0));
  select * into v_booking from public.sauna_bookings b where b.site_id = p_site and b.manual_request_id = p_request_id;
  if found then
    if v_booking.origin = 'panel' and v_booking.status = 'confirmed' and v_booking.kind = p_kind and v_booking.price_cents = p_expected_price
      and exists (select 1 from public.sauna_slots s where s.site_id = p_site and s.id = v_booking.slot_id
                    and s.room_id = p_room and s.starts_at = p_starts_at and s.turn_type_id = p_turn_type)
      and exists (select 1 from public.customers c where c.site_id = p_site and c.id = v_booking.customer_id and c.whatsapp = p_whatsapp) then
      return jsonb_build_object('ok', true, 'booking', to_jsonb(v_booking));
    end if;
    return public.sauna_reject('invalid_request');
  end if;
  return public.sauna_reserve_core(p_site, p_room, p_starts_at, p_turn_type, p_kind, 1, p_name, p_whatsapp, null, null, false, true, p_request_id, p_expected_price);
end $$;

create or replace function public.sauna_availability_core(p_site text, p_from date, p_to date, p_manual boolean)
returns table (
  room_id uuid,
  turn_type_id uuid,
  type_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  free_seats integer,
  price_cents bigint,
  private_price_cents bigint,
  deposit_percent integer,
  closed boolean,
  bookable boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with config as (
    select st.deposit_percent, st.min_lead_minutes, st.max_advance_days, st.start_step_minutes, least(p_to, p_from + 92) as last_day
      from public.sauna_settings st where st.site_id = p_site
  ),
  turns as (
    select r.id as room_id, r.capacity, t.id as turn_type_id, t.name as type_name, t.price_cents, t.private_price_cents,
           coalesce(t.deposit_percent, c.deposit_percent) as deposit_percent, t.duration_minutes,
           (series.moment at time zone 'America/Argentina/Buenos_Aires') as starts_at
      from config c
      cross join lateral generate_series(p_from::timestamp, c.last_day::timestamp, interval '1 day') as dates(day)
      join public.sauna_time_bands b on b.site_id = p_site and b.weekday = extract(dow from dates.day)::smallint
      join public.sauna_rooms r on r.site_id = b.site_id and r.id = b.room_id and r.active
      join public.sauna_band_types bt on bt.site_id = b.site_id and bt.band_id = b.id
      join public.sauna_turn_types t on t.site_id = bt.site_id and t.id = bt.turn_type_id and t.active
      cross join lateral generate_series(
        dates.day::date + b.start_time,
        dates.day::date + b.end_time - make_interval(mins => t.duration_minutes),
        make_interval(mins => c.start_step_minutes)
      ) as series(moment)
  ),
  counted as (
    select u.*, u.starts_at + make_interval(mins => u.duration_minutes) as ends_at,
           greatest(u.capacity - public.sauna_peak_seats(p_site, u.room_id, u.starts_at, u.starts_at + make_interval(mins => u.duration_minutes)), 0)::integer as free_seats,
           public.sauna_is_closed(p_site, u.room_id, u.starts_at, u.starts_at + make_interval(mins => u.duration_minutes)) as closed
      from turns u
  )
  select n.room_id, n.turn_type_id, n.type_name, n.starts_at, n.ends_at, n.capacity, n.free_seats,
         n.price_cents, n.private_price_cents, n.deposit_percent, n.closed,
         not n.closed and n.free_seats > 0
           and ((p_manual and n.starts_at > now()) or (not p_manual and n.starts_at >= now() + make_interval(mins => c.min_lead_minutes)))
           and n.starts_at <= now() + make_interval(hours => c.max_advance_days * 24) as bookable
    from counted n, config c
   order by n.starts_at, n.duration_minutes;
$$;

create or replace function public.sauna_availability(p_site text, p_from date, p_to date)
returns table (
  room_id uuid,
  turn_type_id uuid,
  type_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  free_seats integer,
  price_cents bigint,
  private_price_cents bigint,
  deposit_percent integer,
  closed boolean,
  bookable boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.sauna_availability_core(p_site, p_from, p_to, false);
$$;

create or replace function public.sauna_manual_availability(p_site text, p_from date, p_to date)
returns table (
  room_id uuid,
  turn_type_id uuid,
  type_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  free_seats integer,
  price_cents bigint,
  private_price_cents bigint,
  deposit_percent integer,
  closed boolean,
  bookable boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.sauna_availability_core(p_site, p_from, p_to, true);
$$;

revoke execute on function public.sauna_reserve_core(text, uuid, timestamptz, uuid, text, integer, text, text, text, text, boolean, boolean, uuid, bigint) from public, anon, authenticated;
revoke execute on function public.sauna_reserve_manual(text, uuid, timestamptz, uuid, text, text, text, uuid, bigint) from public, anon, authenticated;
revoke execute on function public.sauna_availability_core(text, date, date, boolean) from public, anon, authenticated;
revoke execute on function public.sauna_manual_availability(text, date, date) from public, anon, authenticated;
grant execute on function public.sauna_reserve_core(text, uuid, timestamptz, uuid, text, integer, text, text, text, text, boolean, boolean, uuid, bigint) to service_role;
grant execute on function public.sauna_reserve_manual(text, uuid, timestamptz, uuid, text, text, text, uuid, bigint) to service_role;
grant execute on function public.sauna_availability_core(text, date, date, boolean) to service_role;
grant execute on function public.sauna_manual_availability(text, date, date) to service_role;

-- Sauna, phase S3: payments (docs/SAUNA.md §6). The account the transfers go to, filled in from the panel. Transfer is offered only when an alias or a
-- CBU/CVU and the holder are there. Mercado Pago needs nothing here: its credentials are server secrets per site (docs/ARCHITECTURE.md §9).
alter table public.sauna_settings add column if not exists transfer_alias text check (transfer_alias ~ '^[A-Za-z0-9.-]{6,20}$');
alter table public.sauna_settings add column if not exists transfer_cbu text check (transfer_cbu ~ '^[0-9]{22}$');
alter table public.sauna_settings add column if not exists transfer_holder text check (char_length(transfer_holder) between 1 and 80);

-- The person chose to pay by transfer: a current hold becomes pending_transfer and keeps its seat for transfer_hold_hours, never past the start of the turn
-- and never less than it already had. The room is locked first, as in sauna_reserve and sauna_confirm_payment: a hold about to lapse competes for its
-- seat with new bookings, so it is extended only while it still holds it. Repeating the request on a pending transfer changes nothing.
create or replace function public.sauna_choose_transfer(p_site text, p_booking uuid, p_actor text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_settings public.sauna_settings;
  v_slot public.sauna_slots;
  v_booking public.sauna_bookings;
  v_expires timestamptz;
begin
  if p_actor is null or p_actor = '' then return public.sauna_reject('invalid_request'); end if;
  select * into v_settings from public.sauna_settings s where s.site_id = p_site;
  if not found or v_settings.transfer_holder is null or (v_settings.transfer_alias is null and v_settings.transfer_cbu is null) then
    return public.sauna_reject('transfer_unavailable');
  end if;

  select s.* into v_slot from public.sauna_bookings b join public.sauna_slots s on s.site_id = b.site_id and s.id = b.slot_id where b.site_id = p_site and b.id = p_booking;
  if not found then return public.sauna_reject('not_found'); end if;
  perform 1 from public.sauna_rooms r where r.site_id = p_site and r.id = v_slot.room_id for update;
  select * into v_booking from public.sauna_bookings b where b.site_id = p_site and b.id = p_booking for update;

  if v_booking.status = 'pending_transfer' and v_booking.expires_at > now() then
    return jsonb_build_object('ok', true, 'booking', to_jsonb(v_booking));
  end if;
  if v_booking.status <> 'held' or v_booking.expires_at <= now() or v_booking.deposit_cents < 1 then
    return public.sauna_reject('invalid_status');
  end if;

  v_expires := greatest(least(now() + make_interval(hours => v_settings.transfer_hold_hours), v_slot.starts_at), v_booking.expires_at);

  insert into public.booking_events (site_id, booking_id, from_status, to_status, actor, note)
  values (p_site, p_booking, v_booking.status, 'pending_transfer', p_actor, '');

  update public.sauna_bookings b
     set status = 'pending_transfer', expires_at = v_expires
   where b.site_id = p_site and b.id = p_booking
  returning * into v_booking;

  return jsonb_build_object('ok', true, 'booking', to_jsonb(v_booking));
end $$;
revoke execute on function public.sauna_choose_transfer(text, uuid, text) from public, anon, authenticated;
grant execute on function public.sauna_choose_transfer(text, uuid, text) to service_role;

-- Sauna, phase S4: codes (docs/SAUNA.md §4). Failed attempts at a code, from the booking form or from a reservation, so nobody can guess codes by trying
-- them one after another. Only a keyed hash of the visitor's address, never the address, and no code text. Rows older than a day are deleted as new ones arrive.
create table if not exists public.sauna_code_attempts (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.sites (id),
  origin_hash text not null check (char_length(origin_hash) between 1 and 64),
  created_at timestamptz not null default now()
);
create index if not exists sauna_code_attempts_origin on public.sauna_code_attempts (site_id, origin_hash, created_at);
alter table public.sauna_code_attempts enable row level security;
revoke all on public.sauna_code_attempts from anon, authenticated;

-- Sauna: the Mercado Pago account each site charges into, connected from the panel with OAuth (docs/SAUNA.md §6). One per site: connecting another
-- account replaces it. The tokens are encrypted by the server (AES-256-GCM, modules/sauna/data/mercadopago-account.ts) before they reach this table,
-- so a copy of the database alone does not let anyone charge or read payments.
create table if not exists public.sauna_mercadopago_accounts (
  site_id text primary key references public.sites (id),
  user_id text not null check (user_id ~ '^[0-9]{1,20}$'),
  nickname text not null default '' check (char_length(nickname) <= 120),
  access_token text not null check (char_length(access_token) between 1 and 2000),
  refresh_token text not null check (char_length(refresh_token) between 1 and 2000),
  expires_at timestamptz not null,
  live_mode boolean not null default true,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sauna_mercadopago_accounts enable row level security;
revoke all on public.sauna_mercadopago_accounts from anon, authenticated;
