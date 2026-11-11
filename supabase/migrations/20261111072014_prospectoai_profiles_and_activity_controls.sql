create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name)<=80),
  education_level text not null default '' check (length(education_level)<=80),
  major text not null default '' check (length(major)<=120),
  career_goal text not null default '' check (length(career_goal)<=500),
  skills text not null default '' check (length(skills)<=1000),
  preferred_location text not null default '' check (length(preferred_location)<=120),
  hours_per_week integer check (hours_per_week between 1 and 80),
  budget text not null default '' check (length(budget)<=120),
  arrangement text not null default '' check (arrangement in ('','Remote','Hybrid','On-site','Flexible')),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
create policy "Own profile select" on public.profiles for select to authenticated using ((select auth.uid())=user_id);
create policy "Own profile insert" on public.profiles for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Own profile update" on public.profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Own profile delete" on public.profiles for delete to authenticated using ((select auth.uid())=user_id);
alter table public.activities add column state text not null default 'Planned' check(state in ('Planned','In progress','Completed','Archived'));
alter table public.activities add column priority text not null default 'Medium' check(priority in ('Low','Medium','High'));
alter table public.activities add column kind text not null default 'Task' check(kind in ('Task','Course','Skill','University','Scholarship','Internship','Job','Research'));
alter table public.resources add column status text not null default 'active' check(status in ('active','expired','draft','archived'));
create extension if not exists pg_cron;
-- Database expiry changes status only. Saved tracker and activity rows are preserved.
select cron.schedule('prospectoai-weekly-expiry', '0 0 * * 1', $job$
  update public.resources set status='expired'
  where kind='opportunity' and status='active'
  and nullif(payload->>'finalDeadline','') is not null
  and (payload->>'finalDeadline')::date < current_date;
$job$);
