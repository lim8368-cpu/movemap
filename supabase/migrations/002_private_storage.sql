insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'movemap-private',
  'movemap-private',
  false,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No anon/authenticated policies are created. The bucket is accessed only by
-- server-side functions using the service role and short-lived signed URLs.

