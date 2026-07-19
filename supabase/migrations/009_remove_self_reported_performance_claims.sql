-- Performance metrics must come from measured user activity, not center input.
update public.centers
set conversion = '센터 문의', updated_at = now()
where conversion ilike '%평균%'
   or conversion ilike '%재방문율%';
