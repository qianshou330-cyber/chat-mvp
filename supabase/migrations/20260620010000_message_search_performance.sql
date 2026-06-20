create extension if not exists pg_trgm;

create index if not exists messages_body_trgm_idx
on public.messages using gin (lower(coalesce(body, '')) gin_trgm_ops);

create index if not exists conversations_title_trgm_idx
on public.conversations using gin (lower(coalesce(title, '')) gin_trgm_ops);

create index if not exists profiles_display_name_trgm_idx
on public.profiles using gin (lower(coalesce(display_name, '')) gin_trgm_ops);

create index if not exists messages_search_type_sender_cursor_idx
on public.messages(message_type, sender_id, created_at desc, id desc)
where deleted_at is null;

create index if not exists messages_search_conversation_cursor_idx
on public.messages(conversation_id, created_at desc, id desc)
where deleted_at is null;

create index if not exists attachments_visible_lookup_idx
on public.attachments(id)
where deleted_at is null;
