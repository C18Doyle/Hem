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
