alter table public.profiles
add column if not exists avatar_media_type text not null default 'image',
add column if not exists avatar_video_url text,
add column if not exists avatar_video_poster_url text,
add column if not exists avatar_video_updated_at timestamptz;

do $$
begin
  alter table public.profiles
  add constraint profiles_avatar_media_type_check
  check (avatar_media_type in ('image', 'video'));
exception
  when duplicate_object then null;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatar-videos',
  'profile-avatar-videos',
  true,
  5242880,
  array['video/mp4', 'video/webm']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads profile avatar videos" on storage.objects;
drop policy if exists "users upload own profile avatar videos" on storage.objects;
drop policy if exists "users update own profile avatar videos" on storage.objects;
drop policy if exists "users delete own profile avatar videos" on storage.objects;

create policy "public reads profile avatar videos"
on storage.objects for select
to public
using (bucket_id = 'profile-avatar-videos');

create policy "users upload own profile avatar videos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-avatar-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users update own profile avatar videos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-avatar-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-avatar-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users delete own profile avatar videos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-avatar-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
