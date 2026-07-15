create table if not exists public.admin_login_attempts (
  key_hash text primary key,
  failed_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz
);

alter table public.admin_login_attempts enable row level security;
revoke all on public.admin_login_attempts from anon, authenticated;
grant select, insert, update, delete on public.admin_login_attempts to service_role;

