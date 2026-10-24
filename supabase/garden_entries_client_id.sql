-- POST /api/garden now upserts using the client-generated id (a UUID from
-- crypto.randomUUID()), so garden_entries.id must be a UUID with a unique
-- constraint. Run in the Supabase SQL editor.

-- 1. See what you currently have.
select data_type, column_default, is_identity
from information_schema.columns
where table_schema = 'public'
  and table_name = 'garden_entries'
  and column_name = 'id';

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.garden_entries'::regclass
  and contype in ('p', 'u');

-- 2A. If data_type is 'uuid' AND a primary key or unique constraint on (id)
--     is listed above: nothing to do.

-- 2B. If data_type is 'uuid' but there is no PK/unique constraint on id:
-- alter table public.garden_entries add constraint garden_entries_pkey primary key (id);

-- 2C. If data_type is bigint/integer (Supabase's default for new tables):
--     convert to uuid. Existing rows get fresh random ids. The app only reads
--     ids back from the API, so nothing else depends on the old values.
-- alter table public.garden_entries alter column id drop identity if exists;
-- alter table public.garden_entries alter column id drop default;
-- alter table public.garden_entries alter column id type uuid using gen_random_uuid();
-- alter table public.garden_entries alter column id set default gen_random_uuid();
