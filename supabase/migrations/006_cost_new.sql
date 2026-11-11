-- Full-price cost new, alongside what was actually paid
alter table items add column if not exists rrp numeric(10,2);
alter table items add column if not exists rrp_estimated boolean not null default false;
