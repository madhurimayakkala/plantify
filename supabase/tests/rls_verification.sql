-- RLS verification: user A must not be able to read or change user B's rows.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL editor and run it.
-- It runs inside a transaction that is ROLLED BACK at the end, so it leaves no
-- data behind. Any failed check raises an exception and stops the script with
-- a message saying which check failed. If it finishes and the last line of
-- output says "RLS verification passed", every check held.
--
-- It impersonates users the way PostgREST does: switch to the `authenticated`
-- role and set request.jwt.claims, which is what auth.jwt() reads.

begin;

-- Seed rows as the table owner (bypasses RLS). Two users, one row each.
insert into public.active_workloads (user_id, name, tasks, started_at, cumulative_water)
values
  ('test_user_a', 'A workload', '[]', now(), 0),
  ('test_user_b', 'B workload', '[]', now(), 0);

insert into public.garden_entries
  (id, user_id, workload_name, stage, stage_emoji, water_percent, tasks_completed, tasks_total, saved_at)
values
  ('00000000-0000-0000-0000-00000000000a', 'test_user_a', 'A plant', 'seed', 's', 10, 1, 2, now()),
  ('00000000-0000-0000-0000-00000000000b', 'test_user_b', 'B plant', 'seed', 's', 20, 1, 2, now());

create or replace function pg_temp.check(label text, ok boolean)
returns void language plpgsql as $$
begin
  if not ok then raise exception 'RLS CHECK FAILED: %', label; end if;
  raise notice 'ok: %', label;
end $$;

-- ---------------------------------------------------------------- user A
set local role authenticated;
set local request.jwt.claims = '{"sub":"test_user_a","role":"authenticated"}';

select pg_temp.check('A sees own workload',
  (select count(*) from public.active_workloads where user_id = 'test_user_a') = 1);
select pg_temp.check('A cannot see B workload (filtered by user_id)',
  (select count(*) from public.active_workloads where user_id = 'test_user_b') = 0);
select pg_temp.check('A sees only own workload rows when unfiltered',
  (select count(*) from public.active_workloads) = 1);
select pg_temp.check('A sees only own garden rows when unfiltered',
  (select count(*) from public.garden_entries) = 1);
select pg_temp.check('A cannot read B garden entry by id',
  (select count(*) from public.garden_entries
    where id = '00000000-0000-0000-0000-00000000000b') = 0);

-- A tries to modify / delete B's rows: allowed statements, but zero rows hit.
with u as (update public.active_workloads set name = 'hacked' where user_id = 'test_user_b' returning 1)
select pg_temp.check('A cannot update B workload', (select count(*) from u) = 0);

with d as (delete from public.garden_entries where user_id = 'test_user_b' returning 1)
select pg_temp.check('A cannot delete B garden entries', (select count(*) from d) = 0);

-- A tries to move own row to B, or insert a row as B: must be rejected.
do $$
begin
  begin
    update public.garden_entries set user_id = 'test_user_b'
    where user_id = 'test_user_a';
    raise exception 'RLS CHECK FAILED: A reassigned a row to B';
  exception when insufficient_privilege then
    raise notice 'ok: A cannot reassign own row to B';
  end;

  begin
    insert into public.garden_entries
      (id, user_id, workload_name, stage, stage_emoji, water_percent, tasks_completed, tasks_total, saved_at)
    values ('00000000-0000-0000-0000-0000000000cc', 'test_user_b', 'forged', 'seed', 's', 1, 0, 1, now());
    raise exception 'RLS CHECK FAILED: A inserted a row as B';
  exception when insufficient_privilege then
    raise notice 'ok: A cannot insert a row owned by B';
  end;
end $$;

-- A can write own rows.
do $$
declare
  n integer;
begin
  insert into public.garden_entries
    (id, user_id, workload_name, stage, stage_emoji, water_percent, tasks_completed, tasks_total, saved_at)
  values ('00000000-0000-0000-0000-0000000000a2', 'test_user_a', 'A plant 2', 'seed', 's', 5, 0, 1, now());
  get diagnostics n = row_count;
  perform pg_temp.check('A can insert own garden entry', n = 1);
end $$;

-- ---------------------------------------------------------------- user B
set local request.jwt.claims = '{"sub":"test_user_b","role":"authenticated"}';

select pg_temp.check('B sees only B rows (workloads)',
  (select count(*) from public.active_workloads where user_id <> 'test_user_b') = 0);
select pg_temp.check('B does not see A garden entries',
  (select count(*) from public.garden_entries where user_id = 'test_user_a') = 0);

-- ------------------------------------------------------ no identity at all
reset role;
set local role anon;
set local request.jwt.claims = '';

do $$
begin
  begin
    perform count(*) from public.active_workloads;
    raise exception 'RLS CHECK FAILED: anon could query active_workloads';
  exception when insufficient_privilege then
    raise notice 'ok: anon has no access to active_workloads';
  end;
  begin
    perform count(*) from public.garden_entries;
    raise exception 'RLS CHECK FAILED: anon could query garden_entries';
  exception when insufficient_privilege then
    raise notice 'ok: anon has no access to garden_entries';
  end;
end $$;

select pg_temp.check('anon can call health_check()', public.health_check() = true);

-- ------------------------------------------- signed in but wrong/missing sub
reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select pg_temp.check('token without sub sees nothing',
  (select count(*) from public.garden_entries) = 0);

reset role;
rollback;

select 'RLS verification passed' as result;
