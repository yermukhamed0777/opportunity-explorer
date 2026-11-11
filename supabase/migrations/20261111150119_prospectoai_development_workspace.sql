-- Additive private development workspace. Existing tracker and profile rows are retained.
create table public.preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 basic jsonb not null default '{}' check(jsonb_typeof(basic)='object' and octet_length(basic::text)<30000),
 field_ids text[] not null default '{}' check(cardinality(field_ids)<=8),
 goals text[] not null default '{}' check(cardinality(goals)<=8),
 onboarding_step smallint not null default 0 check(onboarding_step between 0 and 4),
 onboarding_complete boolean not null default false,
 allow_profile_ai boolean not null default false,
 in_app_reminders boolean not null default true,
 reminder_days smallint not null default 7 check(reminder_days in (3,7,14,30)),
 updated_at timestamptz not null default now()
);
create table public.documents (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 200), path text not null unique check(length(path)<250),
 kind text not null check(kind in ('CV','Portfolio','Transcript','Project list','Personal statement','LinkedIn export')),
 content_type text not null check(content_type in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
 bytes integer not null check(bytes between 1 and 10485760),
 processing_state text not null default 'Uploaded' check(processing_state in ('Uploaded','Processing','Needs review','Reviewed','Error')),
 extracted_text text check(length(extracted_text)<=200000),
 draft jsonb not null default '[]' check(jsonb_typeof(draft)='array' and octet_length(draft::text)<150000),
 error text check(length(error)<=500), created_at timestamptz not null default now(),
 unique(id,user_id), check(split_part(path,'/',1)=user_id::text)
);
create table public.profile_records (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('Education','Course','Certification','Research','Internship','Employment','Volunteering','Club','Competition','Hackathon','Project','Publication','Presentation','Award','Technical skill','Language','Leadership')),
 title text not null check(length(title) between 1 and 200), organization text not null default '' check(length(organization)<=200),
 start_date date,end_date date, details text not null default '' check(length(details)<=4000),
 source_document uuid references public.documents(id) on delete set null,
 ai_allowed boolean not null default false, created_at timestamptz not null default now(),
 check(end_date is null or start_date is null or end_date>=start_date)
);
-- A document reference must belong to the same user, including on UPDATE.
create function public.check_profile_document_owner() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.source_document is not null and not exists(select 1 from public.documents where id=new.source_document and user_id=new.user_id) then raise exception 'Document is not in your workspace.'; end if;
 return new;
end $$;
create trigger profile_document_owner before insert or update on public.profile_records for each row execute function public.check_profile_document_owner();
create table public.user_skills (
 user_id uuid not null references auth.users(id) on delete cascade, skill_id text not null check(length(skill_id) between 1 and 120),
 state text not null default 'Learning' check(state in ('Learning','Developing','Demonstrated')),
 notes text not null default '' check(length(notes)<=2000), evidence text not null default '' check(length(evidence)<=2000),
 updated_at timestamptz not null default now(), primary key(user_id,skill_id)
);
create table public.course_progress (
 user_id uuid not null references auth.users(id) on delete cascade, course_id text not null check(length(course_id) between 1 and 120),
 state text not null default 'Planned' check(state in ('Planned','In progress','Completed')),
 notes text not null default '' check(length(notes)<=2000), target_skill text not null default '' check(length(target_skill)<=120),
 updated_at timestamptz not null default now(), primary key(user_id,course_id)
);
create table public.plans (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 goal text not null check(length(goal) between 1 and 200), weekly_hours numeric(4,1) not null check(weekly_hours>0 and weekly_hours<=80),
 notes text not null default '' check(length(notes)<=3000), created_at timestamptz not null default now(),unique(id,user_id)
);
create table public.plan_items (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 plan_id uuid not null, title text not null check(length(title) between 1 and 200),
 kind text not null default 'Task' check(kind in ('Task','Milestone','Course','Skill','Application','Research','Project','Backup')),
 state text not null default 'Planned' check(state in ('Planned','In progress','Completed','Saved for later')),
 week_start date not null default date_trunc('week',current_date)::date check(week_start=date_trunc('week',week_start)::date),
 weekly_hours numeric(4,1) not null default 1 check(weekly_hours>=0 and weekly_hours<=80),
 due_date date, target_skill text not null default '' check(length(target_skill)<=120),resource_id text check(length(resource_id)<=120),
 dependencies text not null default '' check(length(dependencies)<=1000), notes text not null default '' check(length(notes)<=3000),
 position integer not null default 0 check(position between 0 and 10000), created_at timestamptz not null default now(),
 foreign key(plan_id,user_id) references public.plans(id,user_id) on delete cascade
);
-- Serialize concurrent edits on the parent plan so its weekly time limit cannot be oversubscribed.
create function public.enforce_plan_time_budget() returns trigger language plpgsql security invoker set search_path='' as $$
declare budget numeric; assigned numeric;
begin
 select weekly_hours into budget from public.plans where id=new.plan_id and user_id=new.user_id for update;
 if budget is null then raise exception 'Plan is not in your workspace.'; end if;
 if new.state in ('Planned','In progress') then
  select coalesce(sum(weekly_hours),0) into assigned from public.plan_items where plan_id=new.plan_id and user_id=new.user_id and week_start=new.week_start and state in ('Planned','In progress') and id<>new.id;
  if assigned+new.weekly_hours>budget then raise exception 'This week exceeds the plan time budget. Reduce hours or move an item to another week.'; end if;
 end if;
 return new;
end $$;
create trigger plan_time_budget before insert or update on public.plan_items for each row execute function public.enforce_plan_time_budget();
create function public.enforce_plan_budget_change() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.plan_items where plan_id=new.id and user_id=new.user_id and state in ('Planned','In progress') group by week_start having sum(weekly_hours)>new.weekly_hours) then raise exception 'An existing week exceeds the new budget. Adjust its items first.';end if;
 return new;
end $$;
create trigger plan_budget_change before update on public.plans for each row execute function public.enforce_plan_budget_change();
create table public.saved_searches (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 80),criteria jsonb not null check(jsonb_typeof(criteria)='object' and octet_length(criteria::text)<5000),created_at timestamptz not null default now()
);
create table public.recent_views (
 user_id uuid not null references auth.users(id) on delete cascade,resource_id text not null check(length(resource_id) between 1 and 120),
 title text not null check(length(title) between 1 and 200),kind text not null check(length(kind)<=40),viewed_at timestamptz not null default now(),primary key(user_id,resource_id)
);
create index profile_records_owner_idx on public.profile_records(user_id,kind);
create index documents_owner_idx on public.documents(user_id,created_at desc);
create index plan_items_owner_week_idx on public.plan_items(user_id,plan_id,week_start,position);
create index plans_owner_idx on public.plans(user_id);
create index saved_searches_owner_idx on public.saved_searches(user_id);
create index recent_views_owner_time_idx on public.recent_views(user_id,viewed_at desc);
DO $$ declare t text; begin
 foreach t in array array['preferences','documents','profile_records','user_skills','course_progress','plans','plan_items','saved_searches','recent_views'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create policy "Owner select" on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
 execute format('create policy "Owner insert" on public.%I for insert to authenticated with check ((select auth.uid())=user_id)',t);
 execute format('create policy "Owner update" on public.%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
 execute format('create policy "Owner delete" on public.%I for delete to authenticated using ((select auth.uid())=user_id)',t);
 end loop;
end $$;
revoke all on function public.check_profile_document_owner(),public.enforce_plan_time_budget(),public.enforce_plan_budget_change() from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-documents','profile-documents',false,10485760,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) on conflict(id) do nothing;
create policy "Private document read" on storage.objects for select to authenticated using(bucket_id='profile-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Private document upload" on storage.objects for insert to authenticated with check(bucket_id='profile-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Private document replace" on storage.objects for update to authenticated using(bucket_id='profile-documents' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='profile-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Private document delete" on storage.objects for delete to authenticated using(bucket_id='profile-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Narrow, read-only reauthentication check used by the server account-deletion endpoint.
create function public.has_recent_signin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions where user_id=auth.uid() and id::text=auth.jwt()->>'session_id' and created_at>now()-interval '5 minutes');
$$;
revoke all on function public.has_recent_signin() from public,anon;
grant execute on function public.has_recent_signin() to authenticated;
