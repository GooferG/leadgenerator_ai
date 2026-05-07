-- Migration 004 created `leads_place_id_unique` as a PARTIAL index
-- (where place_id is not null). Postgres allows partial unique indexes as
-- ON CONFLICT targets only when the index predicate is repeated in the query,
-- which the supabase-js `.upsert({ onConflict: 'place_id' })` API can't do.
--
-- Fix: drop the partial index, recreate without the predicate. Postgres's
-- default NULL-handling in unique indexes (`NULLS DISTINCT`, the default)
-- allows multiple null place_ids, so legacy manually-saved leads without
-- a place_id continue to work.

drop index if exists leads_place_id_unique;

create unique index if not exists leads_place_id_unique
  on leads(place_id);
