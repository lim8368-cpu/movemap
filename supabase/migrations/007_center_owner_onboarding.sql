create extension if not exists citext;

alter table public.center_applications
  add column if not exists email citext;

create index if not exists center_applications_email_idx
  on public.center_applications(email);

comment on column public.center_applications.email is
  '센터 승인 후 센터장 대시보드 계정 발급에 사용하는 로그인 이메일';
