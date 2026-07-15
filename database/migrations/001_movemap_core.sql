create extension if not exists pgcrypto;

create table if not exists public.center_applications (
  id uuid primary key default gen_random_uuid(),
  center_name text not null,
  owner_name text not null,
  phone text not null,
  area text not null,
  address text not null,
  naver_map_url text,
  lat double precision,
  lng double precision,
  website text,
  photo_url text,
  photo_path text,
  license_holder_name text not null,
  license_number text not null,
  license_image_path text,
  services text,
  memo text,
  consent boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.centers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid unique references public.center_applications(id) on delete set null,
  name text not null,
  region text not null default 'other',
  area text not null,
  address text not null,
  naver_map_url text,
  lat double precision,
  lng double precision,
  lead text,
  tags text[] not null default '{}',
  therapist text,
  price text,
  conversion text,
  plan text not null default 'free',
  photo_path text,
  status text not null default 'approved' check (status in ('approved', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  center_id uuid references public.centers(id) on delete set null,
  detail text,
  source text not null default 'web',
  created_at timestamptz not null default now()
);

create index if not exists centers_status_idx on public.centers(status);
create index if not exists center_applications_status_idx on public.center_applications(status);
create index if not exists events_created_at_idx on public.events(created_at desc);

alter table public.centers enable row level security;
alter table public.center_applications enable row level security;
alter table public.events enable row level security;

revoke all on public.centers, public.center_applications, public.events from anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on public.centers, public.center_applications, public.events to service_role;
