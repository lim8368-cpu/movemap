create extension if not exists citext;
create extension if not exists pgcrypto;

-- Platform-wide roles are intentionally separate from center memberships.
-- Auth users may live in AUTH_SUPABASE_URL, so these UUIDs do not reference
-- auth.users in the data project.
create table if not exists public.platform_user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email citext,
  role text not null check (role in ('super_admin', 'admin', 'support', 'analyst')),
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  mfa_required boolean not null default true,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists platform_user_roles_role_status_idx
  on public.platform_user_roles(role, status);

create table if not exists public.center_memberships (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  user_id uuid not null,
  email citext not null,
  role text not null default 'staff'
    check (role in ('owner', 'manager', 'staff', 'viewer')),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'suspended', 'revoked')),
  permissions text[] not null default '{}',
  invited_by_user_id uuid,
  accepted_at timestamptz,
  last_active_at timestamptz,
  revoked_by_user_id uuid,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (center_id, user_id)
);

create index if not exists center_memberships_user_status_idx
  on public.center_memberships(user_id, status);
create index if not exists center_memberships_center_status_idx
  on public.center_memberships(center_id, status);

create table if not exists public.center_invitations (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  email citext not null,
  role text not null default 'staff'
    check (role in ('owner', 'manager', 'staff', 'viewer')),
  permissions text[] not null default '{}',
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  invited_by_user_id uuid not null,
  accepted_by_user_id uuid,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists center_invitations_pending_email_idx
  on public.center_invitations(center_id, email)
  where status = 'pending';
create index if not exists center_invitations_expires_idx
  on public.center_invitations(status, expires_at);

create table if not exists public.registration_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  ip_hash text not null,
  captcha_provider text not null
    check (captcha_provider in ('turnstile', 'signed_math')),
  upload_paths text[] not null default '{}',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists registration_sessions_expiry_idx
  on public.registration_sessions(expires_at);

create table if not exists public.access_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  actor_user_id uuid,
  actor_role text not null default 'anonymous',
  center_id uuid references public.centers(id) on delete set null,
  source text not null default 'web',
  method text not null,
  path text not null,
  status_code integer not null,
  duration_ms integer not null default 0,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists access_logs_created_idx
  on public.access_logs(created_at desc);
create index if not exists access_logs_actor_idx
  on public.access_logs(actor_user_id, created_at desc);
create index if not exists access_logs_center_idx
  on public.access_logs(center_id, created_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  actor_user_id uuid,
  actor_role text not null default 'system',
  center_id uuid references public.centers(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  success boolean not null default true,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx
  on public.audit_logs(created_at desc);
create index if not exists audit_logs_center_idx
  on public.audit_logs(center_id, created_at desc);
create index if not exists audit_logs_actor_idx
  on public.audit_logs(actor_user_id, created_at desc);

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  source text not null default 'api',
  error_code text not null,
  message text not null,
  path text,
  status_code integer,
  fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists error_logs_created_idx
  on public.error_logs(created_at desc);
create index if not exists error_logs_fingerprint_idx
  on public.error_logs(fingerprint, created_at desc);

create table if not exists public.operational_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null
    check (alert_type in ('database', 'memory', 'cpu', 'error_rate', 'healthcheck')),
  severity text not null default 'warning'
    check (severity in ('info', 'warning', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved')),
  message text not null,
  metric_value double precision,
  threshold_value double precision,
  metadata jsonb not null default '{}'::jsonb,
  acknowledged_by_user_id uuid,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists operational_alerts_status_created_idx
  on public.operational_alerts(status, created_at desc);

create or replace function public.dail_operational_metrics()
returns table (
  database_size_mb double precision,
  active_connections bigint,
  max_connections integer
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select
    round((pg_database_size(current_database()) / 1024.0 / 1024.0)::numeric, 1)::double precision,
    (
      select count(*)
      from pg_stat_activity
      where datname = current_database()
    ),
    current_setting('max_connections')::integer;
$$;

revoke all on function public.dail_operational_metrics() from public, anon, authenticated;
grant execute on function public.dail_operational_metrics() to service_role;

alter table public.center_owner_accounts
  add column if not exists auth_user_id uuid;

create unique index if not exists center_owner_accounts_auth_user_idx
  on public.center_owner_accounts(auth_user_id)
  where auth_user_id is not null;

alter table public.center_applications
  add column if not exists registration_session_id uuid
    references public.registration_sessions(id) on delete set null,
  add column if not exists applicant_auth_user_id uuid;

alter table public.reviews
  add column if not exists user_id uuid,
  add column if not exists idempotency_key text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.reviews
  drop constraint if exists reviews_status_check;

alter table public.reviews
  add constraint reviews_status_check
  check (status in ('pending', 'approved', 'hidden', 'rejected'));

alter table public.reviews
  alter column status set default 'pending';

create unique index if not exists reviews_user_center_unique_idx
  on public.reviews(user_id, center_id)
  where user_id is not null;
create unique index if not exists reviews_idempotency_unique_idx
  on public.reviews(idempotency_key)
  where idempotency_key is not null;

alter table public.events
  add column if not exists actor_user_id uuid,
  add column if not exists session_hash text,
  add column if not exists idempotency_key text;

create unique index if not exists events_idempotency_unique_idx
  on public.events(idempotency_key)
  where idempotency_key is not null;
create index if not exists events_session_created_idx
  on public.events(session_hash, created_at desc);

alter table public.platform_user_roles enable row level security;
alter table public.center_memberships enable row level security;
alter table public.center_invitations enable row level security;
alter table public.registration_sessions enable row level security;
alter table public.access_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.error_logs enable row level security;
alter table public.operational_alerts enable row level security;

revoke all on
  public.platform_user_roles,
  public.center_memberships,
  public.center_invitations,
  public.registration_sessions,
  public.access_logs,
  public.audit_logs,
  public.error_logs,
  public.operational_alerts
from anon, authenticated;

grant select, insert, update, delete on
  public.platform_user_roles,
  public.center_memberships,
  public.center_invitations,
  public.registration_sessions,
  public.access_logs,
  public.audit_logs,
  public.error_logs,
  public.operational_alerts
to service_role;
