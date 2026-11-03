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
