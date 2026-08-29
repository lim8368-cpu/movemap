create unique index if not exists center_clients_id_center_unique_idx
  on public.center_clients(id, center_id);

create table if not exists public.center_client_assessments (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  client_id uuid not null,
  assessed_on date not null,
  visit_kind text not null default 'follow_up'
    check (visit_kind in ('initial', 'follow_up', 'discharge')),
  template_key text not null default 'dail_visit_v1'
    check (template_key in ('dail_visit_v1')),
  scores_encrypted jsonb not null,
  narrative_encrypted jsonb,
  sensitive_data_consent_at timestamptz not null,
  created_by_user_id uuid,
  updated_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint center_client_assessments_client_center_fk
    foreign key (client_id, center_id)
    references public.center_clients(id, center_id)
    on delete cascade,
  constraint center_client_assessments_scores_object
    check (jsonb_typeof(scores_encrypted) = 'object'),
  constraint center_client_assessments_narrative_object
    check (narrative_encrypted is null or jsonb_typeof(narrative_encrypted) = 'object')
);

create index if not exists center_client_assessments_client_date_idx
  on public.center_client_assessments(center_id, client_id, assessed_on desc, created_at desc);

create index if not exists center_client_assessments_center_date_idx
  on public.center_client_assessments(center_id, assessed_on desc, created_at desc);

alter table public.center_client_assessments enable row level security;

revoke all on public.center_client_assessments from anon, authenticated;
grant select, insert, update, delete on public.center_client_assessments to service_role;

comment on table public.center_client_assessments is
  '센터별 이용자의 반복 방문 평가 기록. 점수와 서술형 내용은 애플리케이션 계층 AES-256-GCM 암호문만 저장하며 서비스 역할 API를 통해서만 접근한다.';

comment on column public.center_client_assessments.template_key is
  '평가 양식 버전 식별자. 양식이 변경되어도 기존 기록의 해석 기준을 보존한다.';

comment on column public.center_client_assessments.scores_encrypted is
  'VAS 등 평가 점수 JSON의 암호문. 진단 또는 의료기록을 의미하지 않는다.';

notify pgrst, 'reload schema';
