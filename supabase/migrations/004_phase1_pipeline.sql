-- Phase 1: pipeline foundation
-- Extends `leads` with discovery/enrichment fields and adds 4 new tables
-- (enrichments, mockups, videos, outreach_messages) for the sales pipeline.
--
-- Decisions baked in (per Phase 1 handoff review):
--   * Keep `user_id` (not renaming to `owner_id`)
--   * Replace status enum with 7 pipeline values; backfill `new` -> `discovered`
--   * Drop per-user (user_id, place_id) unique idx; add global unique on place_id
--   * Keep `name`/`address`/`phone`; add `business_*` cols alongside (transient duplication)
--   * New tables FK -> public.users(id), not auth.users (NextAuth, not Supabase Auth)

-- =========================================================================
-- 1. leads: new columns
-- =========================================================================
alter table leads
  add column if not exists niche text,
  add column if not exists area_label text,
  add column if not exists area_lat numeric,
  add column if not exists area_lng numeric,
  add column if not exists business_name text,
  add column if not exists business_address text,
  add column if not exists business_phone text,
  add column if not exists place_data jsonb,
  add column if not exists is_chain boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- Backfill business_* from existing name/address/phone for current rows
update leads
set business_name = coalesce(business_name, name),
    business_address = coalesce(business_address, address),
    business_phone = coalesce(business_phone, phone);

-- =========================================================================
-- 2. leads.status: replace enum
-- =========================================================================
-- Drop old constraint
alter table leads drop constraint if exists leads_status_check;

-- Backfill: map old vocab -> new vocab
update leads set status = case status
  when 'new'       then 'discovered'
  when 'contacted' then 'sent'
  when 'converted' then 'replied'
  else status
end;

-- Update column default to match new vocab
alter table leads alter column status set default 'discovered';

-- Add new constraint
alter table leads
  add constraint leads_status_check
  check (status in (
    'discovered', 'enriched', 'mockup_ready',
    'video_ready', 'sent', 'replied', 'archived'
  ));

-- =========================================================================
-- 3. leads: indexes
-- =========================================================================
-- Drop per-user uniqueness; replace with global
drop index if exists leads_user_place_unique;

create unique index if not exists leads_place_id_unique
  on leads(place_id)
  where place_id is not null;

create index if not exists leads_niche_idx on leads(niche);
create index if not exists leads_area_label_idx on leads(area_label);

-- =========================================================================
-- 4. leads: updated_at trigger
-- =========================================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on leads;
create trigger leads_set_updated_at
  before update on leads
  for each row execute function set_updated_at();

-- =========================================================================
-- 5. enrichments
-- =========================================================================
create table if not exists enrichments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  diagnosis text,
  site_brief jsonb,
  cold_message text,
  chain_flag_reason text,
  model_version text
);

create index if not exists enrichments_lead_id_idx on enrichments(lead_id);

-- =========================================================================
-- 6. mockups (placeholder; fields finalized in Phase 2)
-- =========================================================================
create table if not exists mockups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  slug text unique not null,
  template_id text,
  props jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mockups_lead_id_idx on mockups(lead_id);

-- =========================================================================
-- 7. videos (placeholder; fields finalized in Phase 3)
-- =========================================================================
create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  mockup_id uuid references mockups(id) on delete set null,
  storage_path text,
  public_url text,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create index if not exists videos_lead_id_idx on videos(lead_id);

-- =========================================================================
-- 8. outreach_messages (placeholder; fields finalized in Phase 4)
-- =========================================================================
create table if not exists outreach_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  sent_by uuid references users(id) on delete set null,
  channel text not null check (channel in ('email', 'sms', 'instagram_dm', 'linkedin', 'phone')),
  subject text,
  body text not null,
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  replied_at timestamptz,
  is_followup boolean not null default false,
  parent_message_id uuid references outreach_messages(id) on delete set null
);

create index if not exists outreach_messages_lead_id_idx on outreach_messages(lead_id);

-- =========================================================================
-- 9. RLS on new tables
-- =========================================================================
-- Shared workspace model: any authenticated request through the API layer
-- (which already gates on session.user.approved) can read/write. We keep RLS
-- enabled as a floor against unauthenticated direct PostgREST hits, but do
-- not enforce per-user isolation here -- the API layer is the source of truth.
alter table enrichments       enable row level security;
alter table mockups           enable row level security;
alter table videos            enable row level security;
alter table outreach_messages enable row level security;

-- Service role (used by supabaseAdmin in the app) bypasses RLS automatically.
-- Anon key gets no policies, so direct REST access is blocked by default.
-- When/if we expose direct browser reads later, add `for select to authenticated using (true)` policies then.
