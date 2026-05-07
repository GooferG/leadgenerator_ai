# Hook v2 — Phase 1 Handoff

## Context

Hook is an existing Next.js + Supabase + NextAuth + Anthropic API + Google Places lead-gen tool, deployed on Vercel. We are extending it into a full sales pipeline that mirrors the workflow from this source post: Google Maps lead discovery → AI enrichment (diagnosis, site brief, cold message) → templated mockup landing pages → Playwright video walkthroughs → Resend-based outreach with scheduled follow-ups.

**Architectural decision:** Hook is the data plane and public-asset host. Claude Code (running locally on the operator's machine) is the orchestration cockpit. Heavy compute like Playwright recording, vision API calls, and batch enrichment runs locally. Hook persists state, hosts public mockup pages, hosts video files via Supabase storage, and provides the UI surface where the sales partner reviews leads and sends outreach.

**Two operators:**
- **Luiz (owner):** runs Claude Code locally to execute pipeline batches
- **Buddy (sales partner):** logs into Hook, browses leads, sends outreach, manages replies

## Before doing anything

Explore the existing codebase first. Do not propose changes until you have read:

1. `app/` directory structure and routing conventions
2. `lib/` and utility patterns (db client setup, API helpers, type defs)
3. Existing Supabase schema (run `supabase db pull` or read migrations folder)
4. Existing NextAuth configuration and any role/tenant patterns in use
5. Existing Google Places client and Anthropic API client
6. `package.json` for installed deps and scripts

Match the existing conventions (naming, folder layout, error handling, validation library, typing style). Do not introduce new patterns unless something is missing. Do not refactor working code. Do not modify UI in this phase.

After exploring, write back a one-page summary of what's already there and what's about to change. Wait for confirmation before running migrations or writing code.

## Phase 1 scope

Build three things, in order:

1. Schema additions and migrations
2. API endpoints
3. The discover skill

That's it. Anything else is out of scope for Phase 1.

---

### 1. Schema additions

Use Supabase migrations. If a `leads` table already exists, alter it; otherwise create it. All other tables are new.

**`leads`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid pk | |
| `created_at`, `updated_at` | timestamptz | auto-managed |
| `owner_id` | uuid | references `auth.users`; the operator who pulled this lead |
| `place_id` | text | unique; Google Places identifier |
| `business_name` | text | |
| `niche` | text | e.g. `cosmetic-dentist`, `roofer`, `landscaper` |
| `area_label` | text | e.g. `West Austin`, `Tempe Old Town` |
| `area_lat`, `area_lng` | numeric | the search anchor used |
| `business_address` | text | |
| `business_phone` | text | nullable |
| `website_url` | text | nullable |
| `rating` | numeric | from Places |
| `review_count` | integer | from Places |
| `place_data` | jsonb | full Place Details payload kept for later use |
| `is_chain` | boolean | default false; populated by enrichment skill in Phase 1.5 |
| `status` | text | one of: `discovered`, `enriched`, `mockup_ready`, `video_ready`, `sent`, `replied`, `archived` |

**`enrichments`** (new)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid pk | |
| `lead_id` | uuid | references `leads` |
| `created_at` | timestamptz | |
| `diagnosis` | text | ~50 words; what's wrong with the current online presence |
| `site_brief` | jsonb | structured: `hero_angle`, `services[]`, `tone`, `palette`, `cta_copy`, `design_choice` |
| `cold_message` | text | <70 words; the outreach message |
| `chain_flag_reason` | text | nullable; populated when Claude detects a chain |
| `model_version` | text | e.g. `claude-opus-4-7` |

**`mockups`** (placeholder, fields finalized in Phase 2)

| Column | Type |
|--------|------|
| `id` | uuid pk |
| `lead_id` | uuid references `leads` |
| `slug` | text unique |
| `template_id` | text |
| `props` | jsonb |
| `published_at` | timestamptz nullable |
| `created_at` | timestamptz |

**`videos`** (placeholder, fields finalized in Phase 3)

| Column | Type |
|--------|------|
| `id` | uuid pk |
| `lead_id` | uuid references `leads` |
| `mockup_id` | uuid references `mockups` |
| `storage_path` | text |
| `public_url` | text |
| `duration_seconds` | integer |
| `created_at` | timestamptz |

**`outreach_messages`** (placeholder, fields finalized in Phase 4)

| Column | Type |
|--------|------|
| `id` | uuid pk |
| `lead_id` | uuid references `leads` |
| `sent_by` | uuid references `auth.users` |
| `channel` | text (`email`, `sms`, `instagram_dm`, `linkedin`, `phone`) |
| `subject` | text nullable |
| `body` | text |
| `sent_at` | timestamptz |
| `opened_at` | timestamptz nullable |
| `replied_at` | timestamptz nullable |
| `is_followup` | boolean default false |
| `parent_message_id` | uuid references `outreach_messages` nullable |

**RLS policies (keep simple):** both operators can read all leads, enrichments, mockups, videos, and outreach in the shared workspace. Both can write. Filter by `owner_id` only when the UI explicitly asks for "my leads." A single shared workspace is the v1 model. Don't build multi-tenant isolation now.

**Indexes:** at minimum `leads.place_id` (unique), `leads.status`, `leads.niche`, `leads.area_label`, `enrichments.lead_id`, `outreach_messages.lead_id`.

---

### 2. API endpoints

Use the repo's existing API route conventions (likely `app/api/.../route.ts` with NextAuth session validation). All routes auth-protected. Validate inputs with the validator already in use (zod, valibot, etc.). Return typed responses.

**`POST /api/leads/bulk`** — accept an array of lead records from the discover skill. Dedupe on `place_id` (skip existing). Return `{ inserted, skipped, lead_ids }`.

**`GET /api/leads`** — list with query params: `status`, `niche`, `area_label`, `owner_id`, `limit`, `offset`. Return paginated leads with their latest enrichment if present.

**`GET /api/leads/:id`** — single lead with enrichment, mockup, video, and outreach history.

**`PATCH /api/leads/:id`** — update mutable fields (`status`, `is_chain`, etc.).

**`POST /api/enrichments`** — create an enrichment for a lead. Used by the enrichment skill in Phase 1.5; build the route now so the foundation is complete.

**Stub-only for later phases** (return 501 with a "phase not yet built" message, but expose the route shape):
- `POST /api/mockups` (Phase 2)
- `POST /api/videos` (Phase 3)
- `POST /api/outreach` (Phase 4)

**Service auth for skills.** The discover skill needs to call `/api/leads/bulk` from outside a browser session. Add a simple service-key auth path: a long random string in `HOOK_SERVICE_API_KEY` env var, validated via a `x-hook-service-key` header, scoped to write endpoints only. Do not use the Supabase service role key directly; we want business logic to stay in Hook's API layer.

---

### 3. Discover skill (Claude Code)

Create the skill in the project's Claude Code config location (likely `.claude/skills/discover/` or wherever the existing setup keeps them; if there are no existing skills, default to `.claude/skills/`).

**File structure:**

```
.claude/skills/discover/
  SKILL.md
  scripts/
    geocode.ts
    places-search.ts
    filter-leads.ts
    push-to-hook.ts
  README.md (optional, internal notes)
```

**SKILL.md content outline:**

```markdown
---
name: discover
description: Find new local-business leads from Google Maps for a specific niche and geography. Use when the user wants to populate the leads table with a fresh batch.
---

# When to use
Trigger when the user says something like "find me 30 cosmetic dentists in West Austin" or "discover roofers in north Phoenix." Don't trigger for general searches; this is for batched lead population.

# Inputs
- niche (required): one of the supported niche presets, or a free-form niche keyword
- city (required)
- areas (optional): list of neighborhoods/sub-areas; if omitted, use city center with wider radius
- filters (optional): { max_reviews, min_rating, has_website, skip_top_n }

# Defaults
- max_reviews: 50
- min_rating: 4.0
- has_website: 'any' (also accepts 'none' or 'present')
- skip_top_n: 3
- per-area radius: 5km (neighborhood) / 15km (city-wide if no neighborhoods given)
- target count per area: 30

# Niche presets (from the source post)
roofer, landscaper, plumber, fence-installer, chimney-repair, hvac,
dental-practice, cosmetic-dentist, salon, law-firm, real-estate-agent,
photographer, event-venue

# Process
1. Geocode each area to lat/lng using Google Geocoding API
2. For each area, run Places Text Search with the niche keyword and a location bias on the lat/lng + radius
3. Combine results across areas, dedupe by place_id
4. Slice off the top N (skip_top_n) results from each area's batch (these are the dominant players)
5. For each surviving result, fetch Place Details to get full data (rating, review_count, website, phone, address, full reviews snippet)
6. Apply filters: rating >= min_rating, review_count <= max_reviews, website matches has_website state
7. POST the filtered batch to /api/leads/bulk on Hook
8. Return a summary: {discovered, after_top_skip, after_filters, inserted, skipped_existing}

# Auth
Use HOOK_SERVICE_API_KEY from the environment, sent as x-hook-service-key header.
GOOGLE_PLACES_API_KEY from the environment for Places + Geocoding.

# Out of scope for this skill
- Chain detection (enrichment skill handles this)
- Website quality scoring (later phase)
- Writing cold messages (enrichment skill)
```

**Implementation notes for the scripts:**

- Reuse Hook's existing Google Places client/wrapper if it's exposed as a shared lib; otherwise duplicate the calls in the skill scripts (don't import across the API/skill boundary).
- Each script should be runnable standalone for debugging (e.g. `tsx scripts/places-search.ts --niche cosmetic-dentist --area "West Austin"`).
- Log progress clearly so the user can see what's happening when they run the skill.
- Handle Places API quota errors gracefully: pause + retry with backoff, surface clear error if quota exhausted.

---

## What NOT to build in Phase 1

- Enrichment skill (Phase 1.5)
- Mockup template renderer (Phase 2)
- Video render pipeline (Phase 3)
- Outreach UI / Resend integration (Phase 4)
- Stats dashboard, follow-up cron worker (Phase 5)
- UI changes to existing Hook screens (defer until Phase 4 redesign)
- Chain detection logic
- Website quality scoring

If you find yourself reaching for any of these, stop.

## Definition of done

Phase 1 is complete when all of these are true:

1. Migrations apply cleanly to the existing Supabase project, locally and on the deployed instance
2. The five new endpoints respond correctly with auth, validation, and proper status codes
3. The three stub endpoints exist and return 501 with a clear message
4. The discover skill, run with a sample input like `niche=cosmetic-dentist, city=Austin, areas=[West Austin], filters={max_reviews:50, min_rating:4.0, has_website:any, skip_top_n:3}`, populates the leads table via the API
5. Both operator accounts can read leads (verified via SQL or the API)
6. RLS policies prevent unauthenticated access; verified by trying a request without a session

## After Phase 1

Phase 1.5 will be the enrichment skill: takes leads with `status='discovered'`, calls Claude with the three-deliverable prompt structure (diagnosis, site brief, cold message), writes to the `enrichments` table, sets `lead.status='enriched'` (or `is_chain=true` and `status='archived'` if Claude flags it as a chain).

The Phase 1.5 prompt structure (for reference, do not implement yet) follows the post's template: senior local marketing strategist persona, 50-word diagnosis, 100-word site brief with hero angle / services / tone / CTA / design choice, and a sub-70-word cold message that opens with one specific observation about the business and ends with a soft ask to see a mockup. Explicit don'ts: no buzzwords, no corporate language, no AI mentions in the cold message.

---

## Source post reference

The pipeline is loosely modeled on this method (Google Maps + Claude + Lovable + Higgsfield), but adapted: instead of Lovable mockups we use templated Next.js pages owned by us, and instead of Higgsfield video we use local Playwright recording. The lead-finding heuristics (niche selection, sub-area search, top-N skip, review/rating filters, website-presence check) are drawn directly from the post.

Key heuristics worth preserving in the implementation:
- Skip the top 3-4 dominant players per area; they don't need a new site
- Look for rating >= 4.0 with review_count under 50 ("solid offline business, weak online presence")
- Narrow geographic queries beat broad ones ("cosmetic dentists in West Austin" >> "dentists in Austin")
- Avoid e-commerce, franchises, national chains, anything where the owner isn't the decision maker

---

## Initial agent task

When you start working on this:

1. Confirm you've read the existing codebase (summary back to the user)
2. Propose the migration SQL for review before applying
3. Propose the API route signatures and validation schemas for review before implementing
4. Implement migrations, then endpoints, then the discover skill, in that order
5. Test the discover skill end-to-end against the deployed Hook instance with a small sample (5 leads max for the first run) before running anything larger
