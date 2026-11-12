-- All fixtures are transaction-only: no usable login, password or retained account.
begin;
insert into auth.users(id,aud,role,email) values
 ('00000000-0000-4000-a000-000000000401','authenticated','authenticated','transaction-one@example.invalid'),
 ('00000000-0000-4000-a000-000000000402','authenticated','authenticated','transaction-two@example.invalid');
insert into private.content_admins(user_id) values('00000000-0000-4000-a000-000000000401');
insert into public.documents(id,user_id,name,path,kind,content_type,bytes) values
 ('00000000-0000-4000-a000-000000000411','00000000-0000-4000-a000-000000000401','one.pdf','00000000-0000-4000-a000-000000000401/one.pdf','CV','application/pdf',10),
 ('00000000-0000-4000-a000-000000000412','00000000-0000-4000-a000-000000000402','two.pdf','00000000-0000-4000-a000-000000000402/two.pdf','CV','application/pdf',10);
insert into public.admissions_folders(id,user_id,university_id,title) values
 ('00000000-0000-4000-a000-000000000421','00000000-0000-4000-a000-000000000401','test-one','First folder'),
 ('00000000-0000-4000-a000-000000000422','00000000-0000-4000-a000-000000000402','test-two','Second folder');
insert into public.profile_records(id,user_id,kind,title) values('00000000-0000-4000-a000-000000000432','00000000-0000-4000-a000-000000000402','Project','Foreign evidence');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-a000-000000000401","role":"authenticated"}',true);
do $$declare v integer;n integer;record jsonb;begin
 if (select count(*) from public.admissions_folders)<>1 then raise exception 'Folder read isolation failed';end if;
 begin
 insert into public.admissions_items(user_id,folder_id,kind,title) values(auth.uid(),'00000000-0000-4000-a000-000000000422','Essay','Foreign folder');raise exception 'Foreign folder accepted';
 exception when foreign_key_violation then null;end;
 begin
 insert into public.folder_documents(user_id,folder_id,document_id) values(auth.uid(),'00000000-0000-4000-a000-000000000421','00000000-0000-4000-a000-000000000412');raise exception 'Foreign document attached';
 exception when foreign_key_violation then null;end;
 begin
 insert into public.evidence_links(user_id,target_kind,target_id,record_id) values(auth.uid(),'skill','mse-1','00000000-0000-4000-a000-000000000432');raise exception 'Foreign evidence accepted';
 exception when raise_exception then if sqlerrm='Foreign evidence accepted' then raise;end if;end;
 begin
 perform public.review_document_entries('00000000-0000-4000-a000-000000000411',null,'[{"kind":"Project","title":"Null revision bypass"}]','[]');raise exception 'Null revision accepted';
 exception when raise_exception then if sqlerrm='Null revision accepted' then raise;end if;end;
 record:='{"id":"test-transaction-project","kind":"project","name":"Transaction-only fixture","checkedOn":"2026-11-12","sources":[["Official","https://example.edu/"]],"method":"Fixture","safety":"No activity","deliverables":"None"}'::jsonb;
 v:=public.publish_intelligence(record,0);if v<>1 then raise exception 'Initial publication version incorrect';end if;
 v:=public.publish_intelligence(record||'{"name":"Corrected fixture"}',1);if v<>2 then raise exception 'Correction version incorrect';end if;
 begin perform public.publish_intelligence(record,1);raise exception 'Stale publication accepted';exception when raise_exception then if sqlerrm='Stale publication accepted' then raise;end if;end;
 if (select count(*) from public.content_versions where record_id=record->>'id')<>2 then raise exception 'Failed publish polluted audit';end if;
 perform public.record_project_evidence(record->>'id','My actual work','A reviewed artifact');
 if (select count(*) from public.evidence_links where target_id=record->>'id')<>1 then raise exception 'Atomic evidence link missing';end if;
 select count(*) into n from public.profile_records;
 begin perform public.record_project_evidence('unknown-project','Invalid target','Does not save');raise exception 'Invalid project accepted';exception when raise_exception then if sqlerrm='Invalid project accepted' then raise;end if;end;
 if (select count(*) from public.profile_records)<>n then raise exception 'Failed evidence write created orphan';end if;
 v:=public.publish_intelligence(record||'{"status":"Archived"}',2);if v<>3 then raise exception 'Archive failed';end if;
 v:=public.publish_intelligence(record,3);if v<>4 then raise exception 'Restore failed';end if;
 if (select count(*) from public.content_versions where record_id=record->>'id')<>4 then raise exception 'Audit history incomplete';end if;
 insert into public.admissions_items(user_id,folder_id,kind,title,body) values(auth.uid(),'00000000-0000-4000-a000-000000000421','Essay','Private essay','Private draft');
 insert into public.saved_resources(user_id,resource_id,kind,title) values(auth.uid(),'test-resource','project','Private saved item');
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-a000-000000000402","role":"authenticated"}',true);
do $$begin
 if public.is_content_admin() then raise exception 'Role escalation';end if;
 if exists(select 1 from public.admissions_items) or exists(select 1 from public.saved_resources) or exists(select 1 from public.evidence_links) then raise exception 'Private workspace leakage';end if;
 if exists(select 1 from public.content_versions) then raise exception 'Admin audit leakage';end if;
 begin perform public.admin_system_snapshot();raise exception 'Nonadmin health accepted';exception when raise_exception then if sqlerrm='Nonadmin health accepted' then raise;end if;end;
 begin perform public.publish_intelligence('{"id":"bad"}',0);raise exception 'Nonadmin publish accepted';exception when raise_exception then if sqlerrm='Nonadmin publish accepted' then raise;end if;end;
 update public.admissions_folders set notes='Cross-owner edit' where user_id='00000000-0000-4000-a000-000000000401';if found then raise exception 'Cross-owner update';end if;
end $$;
reset role;
do $$declare t text;begin
 foreach t in array array['admissions_folders','admissions_items','folder_documents','saved_resources','evidence_links','notification_states','intelligence_records','content_versions','content_candidates'] loop
 if has_table_privilege('anon','public.'||t,'SELECT') then raise exception 'Anonymous grant on %',t;end if;end loop;
end $$;
rollback;
select 'PASS: folder, essay, file-reference and evidence isolation; admin denial; version CAS; correction/archive/restore audit; null-revision guard; atomic evidence rollback. All fixtures rolled back.' as result;
