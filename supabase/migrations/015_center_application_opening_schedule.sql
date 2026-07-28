alter table public.center_applications
  add column if not exists opening_schedule jsonb not null default '{
    "monday":{"closed":false,"open":"09:00","close":"21:00"},
    "tuesday":{"closed":false,"open":"09:00","close":"21:00"},
    "wednesday":{"closed":false,"open":"09:00","close":"21:00"},
    "thursday":{"closed":false,"open":"09:00","close":"21:00"},
    "friday":{"closed":false,"open":"09:00","close":"21:00"},
    "saturday":{"closed":false,"open":"10:00","close":"17:00"},
    "sunday":{"closed":true,"open":"10:00","close":"17:00"}
  }'::jsonb,
  add column if not exists opening_hours text;

comment on column public.center_applications.opening_schedule is
  '센터 등록 시 설정한 요일별 운영시간. 승인 후 centers.opening_schedule로 전달한다.';
