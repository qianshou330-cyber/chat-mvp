create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  enabled boolean not null default true,
  user_agent text,
  last_error text,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_enabled_idx
on public.push_subscriptions(user_id, enabled);

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists "users read own push subscriptions" on public.push_subscriptions;
drop policy if exists "users create own push subscriptions" on public.push_subscriptions;
drop policy if exists "users update own push subscriptions" on public.push_subscriptions;
drop policy if exists "users delete own push subscriptions" on public.push_subscriptions;

create policy "users read own push subscriptions"
on public.push_subscriptions for select
to authenticated
using (user_id = auth.uid());

create policy "users create own push subscriptions"
on public.push_subscriptions for insert
to authenticated
with check (user_id = auth.uid());

create policy "users update own push subscriptions"
on public.push_subscriptions for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users delete own push subscriptions"
on public.push_subscriptions for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.upsert_push_subscription(
  subscription_endpoint text,
  subscription_p256dh text,
  subscription_auth text,
  subscription_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  saved_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(subscription_endpoint), '') = ''
    or coalesce(trim(subscription_p256dh), '') = ''
    or coalesce(trim(subscription_auth), '') = ''
  then
    raise exception 'Incomplete push subscription';
  end if;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    enabled,
    user_agent,
    last_error
  )
  values (
    current_user_id,
    subscription_endpoint,
    subscription_p256dh,
    subscription_auth,
    true,
    subscription_user_agent,
    null
  )
  on conflict (endpoint) do update
  set user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      enabled = true,
      user_agent = excluded.user_agent,
      last_error = null,
      updated_at = now()
  returning id into saved_id;

  return saved_id;
end;
$$;

create or replace function public.disable_push_subscription(subscription_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.push_subscriptions
  set enabled = false,
      updated_at = now()
  where endpoint = subscription_endpoint
    and user_id = current_user_id;

  return found;
end;
$$;

grant execute on function public.upsert_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.disable_push_subscription(text) to authenticated;
