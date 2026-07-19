-- User identities may live in a dedicated Supabase Auth project while
-- application profiles remain in this environment's data project.
alter table public.user_profiles
  drop constraint if exists user_profiles_user_id_fkey;
