alter table public.center_applications
  add column if not exists photo_paths text[] not null default '{}',
  add column if not exists rejection_reason text;

alter table public.centers
  add column if not exists photo_paths text[] not null default '{}';

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 30),
  rating smallint not null check (rating between 1 and 5),
  content text not null check (char_length(content) between 10 and 500),
  status text not null default 'approved' check (status in ('approved', 'hidden')),
  created_at timestamptz not null default now()
);

create index if not exists reviews_center_status_idx on public.reviews(center_id, status, created_at desc);

alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
grant select, insert, update, delete on public.reviews to service_role;

