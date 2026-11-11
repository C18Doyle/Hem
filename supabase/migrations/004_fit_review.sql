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
