create extension if not exists citext;
create extension if not exists pgcrypto;

create table if not exists public.partner_registration_invitations (
  id uuid primary key default gen_random_uuid(),
  partner_application_id uuid not null
    references public.partner_applications(id) on delete cascade,
  email citext not null,
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'used', 'revoked', 'expired')),
  expires_at timestamptz not null,
  sent_at timestamptz,
  email_delivery_status text not null default 'not_configured'
    check (email_delivery_status in ('queued', 'sent', 'not_configured', 'failed')),
  email_error text,
  created_by_user_id uuid,
  used_by_user_id uuid,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partner_registration_invitations_pending_idx
  on public.partner_registration_invitations(partner_application_id)
  where status = 'pending';

create index if not exists partner_registration_invitations_expiry_idx
  on public.partner_registration_invitations(status, expires_at);

alter table public.center_applications
  add column if not exists partner_application_id uuid
    references public.partner_applications(id) on delete set null;

create unique index if not exists center_applications_partner_application_idx
  on public.center_applications(partner_application_id)
  where partner_application_id is not null;

alter table public.partner_registration_invitations enable row level security;

revoke all on table public.partner_registration_invitations from anon, authenticated;
grant select, insert, update, delete on table public.partner_registration_invitations to service_role;

comment on table public.partner_registration_invitations is
  '파트너 사전 신청 승인 후 발급하는 14일 정식 센터 등록 초대와 발송·사용·취소 이력';

comment on column public.partner_registration_invitations.token_hash is
  '초대 링크 원문은 저장하지 않고 SHA-256 해시만 저장한다.';

notify pgrst, 'reload schema';
