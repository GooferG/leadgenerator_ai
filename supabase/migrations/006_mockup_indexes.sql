-- Phase 2: indexes for the public mockup route.
-- The /m/[slug] page does `select * from mockups where slug = $1 and published_at is not null`.
-- mockups.slug already has a unique constraint (created in migration 004) so the lookup is fast,
-- but we add a partial index on published_at to keep null-published rows out of the public path.

create index if not exists mockups_published_idx
  on mockups(published_at)
  where published_at is not null;
