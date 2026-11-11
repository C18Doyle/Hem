-- Brand and manufacturer sustainability ratings (researched from public sources)
create table if not exists brand_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  brand_key text not null,
  name text not null,
  rating jsonb not null,
  assessed_at timestamptz not null default now(),
  unique (user_id, brand_key)
);
alter table brand_ratings enable row level security;
drop policy if exists own on brand_ratings;
create policy own on brand_ratings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
