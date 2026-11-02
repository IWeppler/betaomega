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
