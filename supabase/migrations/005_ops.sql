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
