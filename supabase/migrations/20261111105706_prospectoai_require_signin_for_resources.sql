-- Only signed-in, non-anonymous accounts can read the researched collection.
alter policy "Public researched resources" on public.resources
  to authenticated
  using ((select auth.uid()) is not null and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));
revoke select on public.resources from anon;
