-- Evidence record and provenance link succeed or roll back together under the caller's RLS.
create function public.record_project_evidence(target_id text,project_title text,details text) returns uuid language plpgsql security invoker set search_path='' as $$
declare new_id uuid;begin
 if auth.uid() is null or length(trim(project_title)) not between 1 and 200 or length(trim(details)) not between 1 and 4000 or not exists(select 1 from public.intelligence_records r where r.id=target_id and r.kind in ('project','research') and r.status='Published') then raise exception 'Choose a published project and describe your actual work.';end if;
 insert into public.profile_records(user_id,kind,title,details,ai_allowed) values(auth.uid(),'Project',project_title,details,false) returning id into new_id;
 insert into public.evidence_links(user_id,target_kind,target_id,record_id,project_id,notes) values(auth.uid(),'project',target_id,new_id,target_id,'User-reviewed project evidence');
 return new_id;
end $$;
revoke all on function public.record_project_evidence(text,text,text) from public,anon;
grant execute on function public.record_project_evidence(text,text,text) to authenticated;

create or replace function public.review_document_entries(document_id uuid,expected_revision integer,entries jsonb,remaining_draft jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare owner_id uuid; current_revision integer; entry jsonb; n integer:=0;
begin
 owner_id:=auth.uid();
 if owner_id is null or jsonb_typeof(entries)<>'array' or jsonb_array_length(entries) not between 1 and 80 or octet_length(entries::text)>200000 or jsonb_typeof(remaining_draft)<>'array' then raise exception 'Invalid review request.';end if;
 select revision into current_revision from public.documents where id=document_id and user_id=owner_id for update;
 if current_revision is null or current_revision is distinct from expected_revision then raise exception 'This document review changed. Reload before saving.';end if;
 for entry in select value from jsonb_array_elements(entries) loop
  insert into public.profile_records(user_id,kind,title,organization,details,source_document,ai_allowed) values(owner_id,entry->>'kind',entry->>'title',coalesce(entry->>'organization',''),coalesce(entry->>'details',''),document_id,coalesce((entry->>'ai_allowed')::boolean,false));
  n:=n+1;
 end loop;
 update public.documents set processing_state='Reviewed',draft=remaining_draft,revision=revision+1 where id=document_id and user_id=owner_id;
 return n;
end $$;
revoke all on function public.review_document_entries(uuid,integer,jsonb,jsonb) from public,anon;
grant execute on function public.review_document_entries(uuid,integer,jsonb,jsonb) to authenticated;
