-- Transaction-only isolation fixtures: every row is rolled back; no login is created or used.
begin;
insert into auth.users(id,aud,role,email) values
 ('00000000-0000-4000-a000-000000000101','authenticated','authenticated','rls-one@example.invalid'),
 ('00000000-0000-4000-a000-000000000102','authenticated','authenticated','rls-two@example.invalid');
insert into public.preferences(user_id) values('00000000-0000-4000-a000-000000000101'),('00000000-0000-4000-a000-000000000102');
insert into public.documents(id,user_id,name,path,kind,content_type,bytes) values
 ('00000000-0000-4000-a000-000000000201','00000000-0000-4000-a000-000000000101','one.pdf','00000000-0000-4000-a000-000000000101/one.pdf','CV','application/pdf',10),
 ('00000000-0000-4000-a000-000000000202','00000000-0000-4000-a000-000000000102','two.pdf','00000000-0000-4000-a000-000000000102/two.pdf','CV','application/pdf',10);
insert into public.plans(id,user_id,goal,weekly_hours) values('00000000-0000-4000-a000-000000000301','00000000-0000-4000-a000-000000000101','Five hours',5);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-a000-000000000101","role":"authenticated"}',true);
do $$ declare n integer;begin
 select count(*) into n from public.preferences;if n<>1 then raise exception 'Preference read isolation failed';end if;
 select count(*) into n from public.documents;if n<>1 then raise exception 'Document read isolation failed';end if;
 update public.documents set name='not allowed.pdf' where user_id='00000000-0000-4000-a000-000000000102';get diagnostics n=row_count;if n<>0 then raise exception 'Cross-owner update failed';end if;
 delete from public.documents where user_id='00000000-0000-4000-a000-000000000102';get diagnostics n=row_count;if n<>0 then raise exception 'Cross-owner delete failed';end if;
 begin
  insert into public.profile_records(user_id,kind,title,source_document) values('00000000-0000-4000-a000-000000000101','Education','Bad document','00000000-0000-4000-a000-000000000202');
  raise exception 'Cross-owner document reference was accepted';
 exception when raise_exception then if sqlerrm='Cross-owner document reference was accepted' then raise;end if;end;
 begin
  insert into public.preferences(user_id) values('00000000-0000-4000-a000-000000000103');
  raise exception 'Foreign owner insert was accepted';
 exception when insufficient_privilege then null;end;
 insert into public.plan_items(user_id,plan_id,title,week_start,weekly_hours) values('00000000-0000-4000-a000-000000000101','00000000-0000-4000-a000-000000000301','First task','2026-11-09',3);
 begin
  insert into public.plan_items(user_id,plan_id,title,week_start,weekly_hours) values('00000000-0000-4000-a000-000000000101','00000000-0000-4000-a000-000000000301','Too much','2026-11-09',3);
  raise exception 'Excess hours were accepted';
 exception when raise_exception then if sqlerrm='Excess hours were accepted' then raise;end if;end;
 insert into public.plan_items(user_id,plan_id,title,week_start,weekly_hours) values('00000000-0000-4000-a000-000000000101','00000000-0000-4000-a000-000000000301','Fits','2026-11-09',2);
 begin
  update public.plans set weekly_hours=4 where id='00000000-0000-4000-a000-000000000301';
  raise exception 'Reducing below assigned budget was accepted';
 exception when raise_exception then if sqlerrm='Reducing below assigned budget was accepted' then raise;end if;end;
 begin
  insert into public.plan_items(user_id,plan_id,title,week_start,weekly_hours) values('00000000-0000-4000-a000-000000000101','00000000-0000-4000-a000-000000000301','Tuesday bypass','2026-11-10',5);
  raise exception 'Non-Monday budget bypass was accepted';
 exception when check_violation then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-a000-000000000102","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.plans) or exists(select 1 from public.plan_items) then raise exception 'Plan isolation failed';end if;
 begin
  insert into public.plan_items(user_id,plan_id,title,week_start,weekly_hours) values('00000000-0000-4000-a000-000000000102','00000000-0000-4000-a000-000000000301','Foreign plan','2026-11-09',1);
  raise exception 'Foreign plan was accepted';
 exception when raise_exception then if sqlerrm='Foreign plan was accepted' then raise;end if;end;
end $$;
reset role;
do $$ declare t text;begin
 foreach t in array array['preferences','documents','profile_records','user_skills','course_progress','plans','plan_items','saved_searches','recent_views'] loop
 if has_table_privilege('anon','public.'||t,'SELECT') then raise exception 'Anonymous grant on %',t;end if;
 end loop;
 if exists(select 1 from storage.buckets where id='profile-documents' and public) then raise exception 'Bucket must be private';end if;
 if (select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'Private document %')<>4 then raise exception 'Missing Storage policies';end if;
end $$;
rollback;
select 'PASS: owner read/write/delete, document reference ownership, plan ownership, five-hour budget, Monday boundary, anonymous grants and private Storage policies; fixtures rolled back.' as result;
