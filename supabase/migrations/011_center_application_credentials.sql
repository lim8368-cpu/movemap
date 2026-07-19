alter table public.center_applications
  add column if not exists therapist_background boolean,
  add column if not exists owner_password_scrypt text;

update public.center_applications
set therapist_background = not (
  coalesce(license_holder_name, '') = '해당 없음'
  or coalesce(license_image_path, '') = 'not-applicable'
)
where therapist_background is null;

alter table public.center_applications
  alter column therapist_background set default false,
  alter column therapist_background set not null;

comment on column public.center_applications.therapist_background is
  '센터 대표자의 물리치료사 출신 여부';

comment on column public.center_applications.owner_password_scrypt is
  '센터 승인 시 센터장 계정으로 이전한 뒤 삭제하는 scrypt 비밀번호 해시';
