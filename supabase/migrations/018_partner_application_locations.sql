alter table public.partner_applications
  add column if not exists address text,
  add column if not exists road_address text,
  add column if not exists jibun_address text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists naver_place_id text,
  add column if not exists naver_map_url text;

create index if not exists partner_applications_region_created_idx
  on public.partner_applications(region, created_at desc);

comment on column public.partner_applications.address is
  '파트너 센터 신청자가 네이버 장소 검색에서 선택한 대표 주소';
comment on column public.partner_applications.lat is
  '네이버 장소 검색 결과의 위도';
comment on column public.partner_applications.lng is
  '네이버 장소 검색 결과의 경도';

notify pgrst, 'reload schema';
