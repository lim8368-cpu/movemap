create extension if not exists citext;

alter table public.centers
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists opening_hours text;

create table if not exists public.center_owner_accounts (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null unique references public.centers(id) on delete cascade,
  email citext not null unique,
  password_scrypt text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  failed_count integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists center_owner_accounts_center_idx on public.center_owner_accounts(center_id);
create index if not exists center_owner_accounts_email_idx on public.center_owner_accounts(email);

alter table public.center_owner_accounts enable row level security;
revoke all on public.center_owner_accounts from anon, authenticated;
grant select, insert, update, delete on public.center_owner_accounts to service_role;
