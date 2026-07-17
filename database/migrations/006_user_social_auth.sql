create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nickname text not null default '',
  avatar_url text,
  provider text not null default 'unknown',
  terms_agreed_at timestamptz,
  privacy_agreed_at timestamptz,
  marketing_agreed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from anon;
grant select, insert, update on public.user_profiles to authenticated;

drop policy if exists "users read own profile" on public.user_profiles;
create policy "users read own profile" on public.user_profiles for select to authenticated using (auth.uid() = user_id);
drop policy if exists "users insert own profile" on public.user_profiles;
create policy "users insert own profile" on public.user_profiles for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "users update own profile" on public.user_profiles;
create policy "users update own profile" on public.user_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists user_profiles_provider_idx on public.user_profiles(provider);
