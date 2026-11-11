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
