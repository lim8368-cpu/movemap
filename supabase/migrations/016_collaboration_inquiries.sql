create extension if not exists citext;
create extension if not exists pgcrypto;

create table if not exists public.collaboration_inquiries (
  id uuid primary key default gen_random_uuid(),
  organization_type text not null
    check (organization_type in ('brand', 'institution', 'center', 'media', 'other')),
  organization_name text not null,
  contact_name text not null,
  contact_email citext not null,
  contact_phone text,
  website_url text,
  collaboration_types text[] not null default '{}',
  title text not null,
  message text not null,
  status text not null default 'received'
    check (status in ('received', 'reviewing', 'contacted', 'closed')),
  source text not null default 'web'
    check (source in ('web', 'ios', 'android')),
  privacy_consent boolean not null default false,
  consented_at timestamptz,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collaboration_inquiries_status_created_idx
  on public.collaboration_inquiries(status, created_at desc);
create index if not exists collaboration_inquiries_email_created_idx
  on public.collaboration_inquiries(contact_email, created_at desc);

alter table public.collaboration_inquiries enable row level security;

revoke all on table public.collaboration_inquiries from anon, authenticated;
grant select, insert, update, delete on table public.collaboration_inquiries to service_role;

comment on table public.collaboration_inquiries is
  'DAIL 웹·앱에서 접수된 브랜드, 기관, 센터 및 미디어 협업 제안';
