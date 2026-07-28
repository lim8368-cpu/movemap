create table if not exists public.user_favorites (
  user_id uuid not null,
  center_id uuid not null references public.centers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, center_id)
);

create index if not exists user_favorites_user_created_idx
  on public.user_favorites(user_id, created_at desc);

alter table public.user_favorites enable row level security;
revoke all on public.user_favorites from anon, authenticated;
grant select, insert, delete on public.user_favorites to service_role;

comment on table public.user_favorites is
  'DAIL 로그인 사용자가 관심 센터로 저장한 목록. 외부 Auth 프로젝트 사용자도 지원하므로 user_id에는 FK를 두지 않는다.';
