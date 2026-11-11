-- Private workspaces. The public catalog remains readable without an account.
create table public.trackers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  saved_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(saved_ids) = 'array' and octet_length(saved_ids::text) < 30000),
  progress jsonb not null default '{}'::jsonb check (jsonb_typeof(progress) = 'object' and octet_length(progress::text) < 150000),
  updated_at timestamptz not null default now()
);
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  resource_id text check (length(resource_id) <= 120),
  status text not null default 'To do' check (status in ('To do','In progress','Done')),
  notes text not null default '' check (length(notes) <= 3000),
  due_date date,
  updated_at timestamptz not null default now()
);
create index activities_owner_due_idx on public.activities(user_id, due_date);
create table public.resources (
  id text primary key,
  kind text not null check (kind in ('opportunity','university','skill','course','career')),
  payload jsonb not null,
  checked_on date not null,
  published_at timestamptz not null default now()
);
create index resources_kind_idx on public.resources(kind);
alter table public.trackers enable row level security;
alter table public.activities enable row level security;
alter table public.resources enable row level security;
revoke all on public.trackers, public.activities, public.resources from anon, authenticated;
grant select, insert, update, delete on public.trackers, public.activities to authenticated;
grant select on public.resources to anon, authenticated;
create policy "Own tracker select" on public.trackers for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own tracker insert" on public.trackers for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own tracker update" on public.trackers for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own tracker delete" on public.trackers for delete to authenticated using ((select auth.uid()) = user_id);
create policy "Own activities select" on public.activities for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own activities insert" on public.activities for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own activities update" on public.activities for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own activities delete" on public.activities for delete to authenticated using ((select auth.uid()) = user_id);
create policy "Public researched resources" on public.resources for select to anon, authenticated using (true);
-- Server-enforced usage counters; clients cannot edit or reset them.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  requests integer not null default 0,
  primary key (user_id, usage_date)
);
alter table private.ai_daily_usage enable row level security;
create function public.reserve_ai_request() returns boolean
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); total integer; used integer;
begin
  if caller is null then return false; end if;
  perform pg_advisory_xact_lock(847225);
  select coalesce(sum(requests), 0) into total from private.ai_daily_usage where usage_date = current_date;
  if total >= 200 then return false; end if;
  insert into private.ai_daily_usage(user_id, usage_date, requests) values(caller, current_date, 0) on conflict do nothing;
  select requests into used from private.ai_daily_usage where user_id = caller and usage_date = current_date for update;
  if used >= 10 then return false; end if;
  update private.ai_daily_usage set requests = requests + 1 where user_id = caller and usage_date = current_date;
  return true;
end $$;
revoke all on function public.reserve_ai_request() from public, anon;
grant execute on function public.reserve_ai_request() to authenticated;
