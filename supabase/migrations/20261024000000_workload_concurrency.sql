-- Optimistic concurrency for PUT /api/workload (Task 4).
--
-- The API now does a compare-and-swap on active_workloads.updated_at:
--   * first save   -> INSERT; a duplicate-key error (23505) means "someone
--                     already created it", which the API reports as 409.
--   * later saves  -> UPDATE ... WHERE user_id = ? AND updated_at = ?
-- The API stamps updated_at itself on every write.
--
-- Safe to run more than once. Run in the Supabase SQL editor, or with
-- `supabase db push`.

begin;

-- 1. updated_at must exist. (If your table already has it, this does nothing.)
alter table public.active_workloads
  add column if not exists updated_at timestamptz not null default now();

-- 2. One workload per user. The create-only INSERT relies on this to detect
--    an existing row. Skipped if user_id already has a primary key / unique
--    index of its own. If you have duplicate rows for a user this will fail
--    and roll back; delete the extras first.
do $$
begin
  if not exists (
    select 1
    from pg_index i
    join pg_attribute a
      on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
    where i.indrelid = 'public.active_workloads'::regclass
      and i.indisunique
      and i.indnatts = 1
      and a.attname = 'user_id'
  ) then
    create unique index active_workloads_user_id_key
      on public.active_workloads (user_id);
  end if;
end $$;

commit;
