alter table public.registration_sessions
  drop constraint if exists registration_sessions_captcha_provider_check;

alter table public.registration_sessions
  add constraint registration_sessions_captcha_provider_check
  check (captcha_provider in ('turnstile', 'signed_math', 'signed_passive'));
