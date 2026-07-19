-- Manual deployment mirror of the Supabase migration.
update public.centers
set conversion = '센터 문의', updated_at = now()
where conversion ilike '%평균%'
   or conversion ilike '%재방문율%';
