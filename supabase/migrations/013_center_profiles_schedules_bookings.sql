alter table public.centers
  add column if not exists manager_career text,
  add column if not exists opening_schedule jsonb not null default '{
    "monday":{"closed":false,"open":"09:00","close":"21:00"},
    "tuesday":{"closed":false,"open":"09:00","close":"21:00"},
    "wednesday":{"closed":false,"open":"09:00","close":"21:00"},
    "thursday":{"closed":false,"open":"09:00","close":"21:00"},
    "friday":{"closed":false,"open":"09:00","close":"21:00"},
    "saturday":{"closed":false,"open":"10:00","close":"17:00"},
    "sunday":{"closed":true,"open":"10:00","close":"17:00"}
  }'::jsonb,
  add column if not exists booking_slot_minutes integer not null default 60,
  add column if not exists booking_enabled boolean not null default true;

alter table public.centers
  drop constraint if exists centers_booking_slot_minutes_check;

alter table public.centers
  add constraint centers_booking_slot_minutes_check
  check (booking_slot_minutes in (30, 60, 90, 120));

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  user_id uuid not null,
  customer_name text not null,
  customer_phone text not null,
  pain_area text not null,
  customer_note text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  idempotency_key text not null unique,
  privacy_consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint bookings_valid_time check (end_at > start_at)
);

create unique index if not exists bookings_active_center_start_unique
  on public.bookings(center_id, start_at)
  where status in ('pending', 'confirmed');

create index if not exists bookings_center_start_idx
  on public.bookings(center_id, start_at);

create index if not exists bookings_user_created_idx
  on public.bookings(user_id, created_at desc);

alter table public.bookings enable row level security;
revoke all on public.bookings from anon, authenticated;
grant select, insert, update, delete on public.bookings to service_role;

comment on table public.bookings is
  'DAIL 센터 예약. 연락처와 불편 부위가 포함되므로 서비스 역할과 센터 권한을 통해서만 접근한다.';

comment on column public.bookings.pain_area is
  '예약 준비 목적의 이용자 입력 정보. 진단명이나 상세 의료기록 수집 용도가 아니다.';
