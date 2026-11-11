-- Hem schema. Run once in the Supabase SQL editor.
-- Every table is private to its owner via row-level security.

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  category text not null default 'Tops',
  brand text,
  colours text[] default '{}',
  pattern text,
  material text,
  fit text,
  formality int check (formality between 1 and 5),   -- 1 loungewear .. 5 black tie
  warmth int check (warmth between 1 and 5),         -- 1 summer weight .. 5 heavy winter
  seasons text[] default '{}',
  description text,
  photo_path text,
  price_paid numeric(10,2),
  purchased_on date,
  quality jsonb,            -- latest quality assessment
  care jsonb,               -- care instructions from the assessment
  retired boolean default false,
  created_at timestamptz default now()
);

create table if not exists wears (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  item_id uuid not null references items on delete cascade,
  worn_on date not null default current_date,
  outfit_id uuid,
  created_at timestamptz default now()
);

-- Condition check-ins: how the item is actually holding up
create table if not exists conditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  item_id uuid not null references items on delete cascade,
  rating int not null check (rating between 1 and 5),  -- 5 like new .. 1 worn out
  issues text[] default '{}',                          -- pilling, fading, stretching...
  noted_on date not null default current_date
);

create table if not exists outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text,
  occasion text,
  item_ids uuid[] not null default '{}',
  suggested jsonb default '[]',   -- pieces you don't own yet
  why text,
  source text,                    -- 'style' | 'today'
  status text not null default 'suggested' check (status in ('suggested','saved','rejected','worn')),
  reject_reason text,
  created_at timestamptz default now()
);

create table if not exists care_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  item_id uuid not null references items on delete cascade,
  kind text not null check (kind in ('care','repair','reminder')),
  note text not null,
  due_on date,
  repeat_days int,               -- for reminders that recur
  done_on date,
  cost numeric(10,2),
  created_at timestamptz default now()
);

create table if not exists wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  query text not null,
  target_price numeric(10,2),
  last_price numeric(10,2),
  last_url text,
  last_retailer text,
  last_checked timestamptz,
  alert boolean default false,
  created_at timestamptz default now()
);

do $$ declare t text; begin
  foreach t in array array['items','wears','conditions','outfits','care_logs','wishlist'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own on %I', t);
    execute format('create policy own on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

create index if not exists wears_item on wears(item_id);
create index if not exists wears_user_date on wears(user_id, worn_on desc);
create index if not exists outfits_user on outfits(user_id, created_at desc);

-- Private photo bucket; files live under <user_id>/...
insert into storage.buckets (id, name, public) values ('wardrobe','wardrobe', false)
  on conflict (id) do nothing;
drop policy if exists "own photos" on storage.objects;
create policy "own photos" on storage.objects for all
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
-- Run this if you already ran schema.sql before this update. (schema.sql now includes it.)
alter table items add column if not exists acquired text not null default 'new';
alter table items drop constraint if exists items_acquired_check;
alter table items add constraint items_acquired_check check (acquired in ('new','secondhand','vintage','gifted','rented'));
alter table items add column if not exists certifications text[] default '{}';

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  item_ids uuid[] not null default '{}',
  note text,
  unique (user_id, day)
);
alter table plans enable row level security;
drop policy if exists own on plans;
create policy own on plans for all using (user_id = auth.uid()) with check (user_id = auth.uid());
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
-- Fit, garment measurements and body measurements
alter table items add column if not exists measures jsonb default '{}';
alter table items add column if not exists fit text check (fit in ('well','ok','poor'));
alter table items add column if not exists fit_issues text[] default '{}';

create table if not exists body_measurements (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);
alter table body_measurements enable row level security;
drop policy if exists own on body_measurements;
create policy own on body_measurements for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Cost tracking, settings, error log, day tags, price history
create table if not exists api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  at timestamptz not null default now(),
  endpoint text not null,
  model text,
  input_tokens int default 0,
  output_tokens int default 0,
  web_searches int default 0,
  cost_gbp numeric(10,4) default 0
);
create index if not exists api_usage_user_at on api_usage(user_id, at desc);

create table if not exists settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  monthly_cap_gbp numeric(8,2) not null default 10,
  email_alerts boolean not null default true,
  alert_drop_pct int not null default 15,
  updated_at timestamptz default now()
);

create table if not exists error_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users on delete cascade,
  at timestamptz not null default now(),
  source text not null,          -- 'client' | 'api:<endpoint>' | 'cron'
  message text not null,
  detail jsonb
);
create index if not exists error_log_user_at on error_log(user_id, at desc);

create table if not exists day_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  tags text[] not null default '{}',
  note text,
  unique (user_id, day)
);

create table if not exists price_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  wishlist_id uuid not null references wishlist on delete cascade,
  price numeric(10,2) not null,
  retailer text,
  url text,
  checked_at timestamptz not null default now()
);
create index if not exists price_history_w on price_history(wishlist_id, checked_at);

alter table wishlist add column if not exists lowest_price numeric(10,2);
alter table wishlist add column if not exists notified_price numeric(10,2);
alter table wishlist add column if not exists alert_reason text;

do $$ declare t text; begin
  foreach t in array array['api_usage','settings','error_log','day_tags','price_history'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own on %I', t);
    execute format('create policy own on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
-- Full-price cost new, alongside what was actually paid
alter table items add column if not exists rrp numeric(10,2);
alter table items add column if not exists rrp_estimated boolean not null default false;
-- Overnight half-price work via the Message Batches API
create table if not exists batch_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('wishlist','brand')),
  ref text not null,                 -- wishlist id, or brand name
  status text not null default 'queued' check (status in ('queued','submitted','done','failed')),
  anthropic_batch_id text,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists batch_jobs_status on batch_jobs(status, anthropic_batch_id);
alter table batch_jobs enable row level security;
drop policy if exists own on batch_jobs;
create policy own on batch_jobs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
