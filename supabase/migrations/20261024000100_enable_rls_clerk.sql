-- Real Row Level Security, driven by Clerk session tokens (Task 5).
--
-- Before this, the API used the service role key, which bypasses RLS. The API
-- now talks to Supabase as the signed-in user (anon key + Clerk token), so
-- these policies are what actually stop one user reading another's rows.
--
-- PREREQUISITES (dashboard steps, see the README / hand-off notes):
--   1. Clerk: the Supabase integration is enabled, so session tokens carry
--      "role": "authenticated".
--   2. Supabase: Clerk is added under Authentication > Sign In / Up >
--      Third-Party Auth.
-- Without both, signed-in users reach the database as `anon` and will see no
-- data after this migration.
--
-- Run AFTER 20261024000000_workload_concurrency.sql. Safe to run again.

begin;

-- 1. Start from a known state: remove every existing policy on these two
--    tables. Policies are OR-ed together, so a forgotten permissive one
--    (e.g. "using (true)") would silently defeat the ones created below.
--    (It also lets step 2 change user_id's type, which old policies block.)
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('active_workloads', 'garden_entries')
  loop
    raise notice 'Dropping existing policy % on %', pol.policyname, pol.tablename;
    execute format(
      'drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename
    );
  end loop;
end $$;

-- 2. Clerk user ids look like "user_2abc...", so user_id must be text.
--    Does nothing if it already is. Fails (and rolls everything back) if a
--    view still depends on the column; drop such a view by hand first.
do $$
declare
  t text;
begin
  foreach t in array array['active_workloads', 'garden_entries'] loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = t
        and column_name = 'user_id'
        and data_type <> 'text'
    ) then
      execute format(
        'alter table public.%I alter column user_id type text using user_id::text',
        t
      );
    end if;
  end loop;
end $$;

-- 3. Turn RLS on. With RLS on and no matching policy, a role sees nothing.
alter table public.active_workloads enable row level security;
alter table public.garden_entries   enable row level security;

-- 4. Table privileges: signed-in users only. `anon` gets nothing.
revoke all on public.active_workloads from anon;
revoke all on public.garden_entries   from anon;
grant select, insert, update, delete on public.active_workloads to authenticated;
grant select, insert, update, delete on public.garden_entries   to authenticated;

-- 5. Policies: a row is visible and writable only when its user_id equals
--    the "sub" claim of the caller's token (the Clerk user id).
--    `(select auth.jwt() ->> 'sub')` is the same check as
--    `auth.jwt() ->> 'sub'`, wrapped so Postgres evaluates it once per
--    query instead of once per row.

-- active_workloads
create policy "active_workloads_select_own" on public.active_workloads
  for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

create policy "active_workloads_insert_own" on public.active_workloads
  for insert to authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "active_workloads_update_own" on public.active_workloads
  for update to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "active_workloads_delete_own" on public.active_workloads
  for delete to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

-- garden_entries
create policy "garden_entries_select_own" on public.garden_entries
  for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

create policy "garden_entries_insert_own" on public.garden_entries
  for insert to authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "garden_entries_update_own" on public.garden_entries
  for update to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "garden_entries_delete_own" on public.garden_entries
  for delete to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

-- 6. Public health check for GET /api/health (and the keep-alive ping).
--    Reads no table and returns only `true`, so it is safe to expose to
--    `anon`, and it keeps working while anon has no table access.
create or replace function public.health_check()
returns boolean
language sql
stable
as $$ select true $$;

revoke all on function public.health_check() from public;
grant execute on function public.health_check() to anon, authenticated;

commit;
