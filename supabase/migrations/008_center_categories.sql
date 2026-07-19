alter table public.centers
  add column if not exists categories text[] not null default '{}';
