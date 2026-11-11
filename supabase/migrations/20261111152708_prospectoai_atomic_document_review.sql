alter table public.documents add column revision integer not null default 0 check(revision>=0);
-- An invoker transaction saves only the owner's reviewed entries and consumes the draft once.
create function public.review_document_entries(document_id uuid,expected_revision integer,entries jsonb,remaining_draft jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare owner_id uuid; current_revision integer; entry jsonb; n integer:=0;
begin
 owner_id:=auth.uid();
 if owner_id is null or jsonb_typeof(entries)<>'array' or jsonb_array_length(entries) not between 1 and 80 or octet_length(entries::text)>200000 or jsonb_typeof(remaining_draft)<>'array' then raise exception 'Invalid review request.';end if;
 select revision into current_revision from public.documents where id=document_id and user_id=owner_id for update;
 if current_revision is null or current_revision<>expected_revision then raise exception 'This document review changed. Reload before saving.';end if;
 for entry in select value from jsonb_array_elements(entries) loop
  insert into public.profile_records(user_id,kind,title,organization,details,source_document,ai_allowed) values(owner_id,entry->>'kind',entry->>'title',coalesce(entry->>'organization',''),coalesce(entry->>'details',''),document_id,coalesce((entry->>'ai_allowed')::boolean,false));
  n:=n+1;
 end loop;
 update public.documents set processing_state='Reviewed',draft=remaining_draft,revision=revision+1 where id=document_id and user_id=owner_id;
 return n;
end $$;
revoke all on function public.review_document_entries(uuid,integer,jsonb,jsonb) from public,anon;
grant execute on function public.review_document_entries(uuid,integer,jsonb,jsonb) to authenticated;
