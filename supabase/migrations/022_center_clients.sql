create extension if not exists pgcrypto;

create table if not exists public.center_clients (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  full_name_encrypted jsonb not null,
  phone_encrypted jsonb not null,
  email_encrypted jsonb,
  primary_concern_encrypted jsonb,
  goal_encrypted jsonb,
  notes_encrypted jsonb,
  phone_lookup_hash text not null,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  privacy_consent_at timestamptz not null,
  created_by_user_id uuid,
  updated_by_user_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint center_clients_full_name_encrypted_object
    check (jsonb_typeof(full_name_encrypted) = 'object'),
  constraint center_clients_phone_encrypted_object
    check (jsonb_typeof(phone_encrypted) = 'object'),
  constraint center_clients_optional_encrypted_objects
    check (
      (email_encrypted is null or jsonb_typeof(email_encrypted) = 'object') and
      (primary_concern_encrypted is null or jsonb_typeof(primary_concern_encrypted) = 'object') and
      (goal_encrypted is null or jsonb_typeof(goal_encrypted) = 'object') and
      (notes_encrypted is null or jsonb_typeof(notes_encrypted) = 'object')
    ),
  constraint center_clients_phone_lookup_hash_length
    check (char_length(phone_lookup_hash) = 43),
  constraint center_clients_archive_state_consistent
    check (
      (status = 'active' and archived_at is null) or
      (status = 'archived' and archived_at is not null)
    )
);

create index if not exists center_clients_center_status_created_idx
  on public.center_clients(center_id, status, created_at desc);

create index if not exists center_clients_center_phone_lookup_idx
  on public.center_clients(center_id, phone_lookup_hash);

create index if not exists center_clients_center_created_idx
  on public.center_clients(center_id, created_at desc);

alter table public.center_clients enable row level security;

revoke all on public.center_clients from anon, authenticated;
grant select, insert, update, delete on public.center_clients to service_role;

comment on table public.center_clients is
  '센터별 이용자 명단. 개인정보 필드는 애플리케이션 계층 AES-256-GCM 암호문만 저장하며 서비스 역할 API를 통해서만 접근한다.';

comment on column public.center_clients.phone_lookup_hash is
  '센터 내 중복 연락처 확인을 위한 정규화 전화번호 HMAC. 원문 전화번호는 저장하지 않는다.';

comment on column public.center_clients.primary_concern_encrypted is
  '이용자가 표현한 주요 불편 사항. 진단명 또는 진료기록 용도로 사용하지 않는다.';

notify pgrst, 'reload schema';
