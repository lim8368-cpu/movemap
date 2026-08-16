create extension if not exists citext;
create extension if not exists pgcrypto;

create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_name text not null,
  center_name text,
  center_stage text not null
    check (center_stage in ('operating', 'preparing', 'planning')),
  qualification_type text not null
    check (qualification_type in ('physical_therapist', 'sports_science', 'other')),
  region text not null,
  contact_email citext not null,
  contact_phone text not null,
  website_url text,
  interests text[] not null default '{}',
  message text,
  status text not null default 'received'
    check (status in ('received', 'reviewing', 'contacted', 'qualified', 'invited', 'converted', 'closed')),
  admin_note text,
  source text not null default 'web'
    check (source in ('web', 'ios', 'android')),
  privacy_consent boolean not null default false,
  consented_at timestamptz,
  ip_hash text,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_applications_status_created_idx
  on public.partner_applications(status, created_at desc);
create index if not exists partner_applications_email_created_idx
  on public.partner_applications(contact_email, created_at desc);
create index if not exists partner_applications_phone_created_idx
  on public.partner_applications(contact_phone, created_at desc);

alter table public.partner_applications enable row level security;

revoke all on table public.partner_applications from anon, authenticated;
grant select, insert, update, delete on table public.partner_applications to service_role;

comment on table public.partner_applications is
  '로그인 없이 접수한 DAIL 센터 파트너 사전 신청과 운영팀 후속 연락 상태';
