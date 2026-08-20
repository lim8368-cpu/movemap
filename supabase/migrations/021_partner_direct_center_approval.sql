alter table public.partner_applications
  add column if not exists applicant_auth_user_id uuid,
  add column if not exists approved_center_id uuid references public.centers(id) on delete set null,
  add column if not exists approved_at timestamptz;

alter table public.centers
  add column if not exists partner_application_id uuid
    references public.partner_applications(id) on delete set null;

create index if not exists partner_applications_auth_user_created_idx
  on public.partner_applications(applicant_auth_user_id, created_at desc)
  where applicant_auth_user_id is not null;

create index if not exists partner_applications_approved_center_idx
  on public.partner_applications(approved_center_id)
  where approved_center_id is not null;

create unique index if not exists centers_partner_application_idx
  on public.centers(partner_application_id)
  where partner_application_id is not null;

comment on table public.partner_applications is
  'DAIL 계정으로 접수한 파트너 센터 신청과 운영팀 검토·센터 권한 연결 상태';

comment on column public.partner_applications.applicant_auth_user_id is
  '신청 시 로그인한 DAIL Auth 사용자. 승인 시 센터 소유자 권한을 이 사용자에게 연결한다.';

comment on column public.partner_applications.approved_center_id is
  '최고관리자 승인으로 생성된 센터. 별도 등록 초대 링크 없이 신청 정보에서 직접 생성한다.';

notify pgrst, 'reload schema';
