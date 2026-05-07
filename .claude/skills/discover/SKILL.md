---
name: discover
description: Find new local-business leads from Google Maps for a specific niche and geography. Use when the user wants to populate the leads table with a fresh batch.
---

# When to use

Trigger when the user says something like "find me 30 cosmetic dentists in West Austin" or "discover roofers in north Phoenix." Don't trigger for general searches; this is for batched lead population.

# Inputs

- `niche` (required): one of the supported niche presets, or a free-form niche keyword
- `city` (required)
- `areas` (optional): list of neighborhoods/sub-areas; if omitted, use city center with wider radius
- `filters` (optional): `{ max_reviews, min_rating, has_website, skip_top_n }`

# Defaults

- `max_reviews`: 50
- `min_rating`: 4.0
- `has_website`: `'any'` (also accepts `'none'` or `'present'`)
- `skip_top_n`: 3
- per-area radius: 5km (neighborhood) / 15km (city-wide if no neighborhoods given)
- target count per area: 30

# Niche presets

```
roofer, landscaper, plumber, fence-installer, chimney-repair, hvac,
dental-practice, cosmetic-dentist, salon, law-firm, real-estate-agent,
photographer, event-venue
```

# Process

1. Geocode each area to lat/lng using Google Geocoding API
2. For each area, run Places Text Search with the niche keyword and a `locationBias` on the lat/lng + radius
3. Combine results across areas, dedupe by `place_id`
4. Slice off the top `skip_top_n` results from each area's batch (these are the dominant players)
5. Apply filters: `rating >= min_rating`, `review_count <= max_reviews`, website matches `has_website` state
6. POST the filtered batch to `/api/leads/bulk` on Hook
7. Return a summary: `{ discovered, after_top_skip, after_filters, inserted, skipped_existing }`

# Auth

- `HOOK_SERVICE_API_KEY` — sent as `x-hook-service-key` header on the bulk POST
- `GOOGLE_PLACES_API_KEY` — used for both Places Text Search and Geocoding
- `HOOK_API_BASE_URL` — defaults to `http://localhost:3000`; set to your Vercel URL for prod

# Running

The orchestrator script accepts a JSON input file or inline args:

```sh
# Inline (single area)
npx tsx .claude/skills/discover/scripts/run.ts \
  --niche cosmetic-dentist \
  --city "Austin, TX" \
  --area "West Austin"

# JSON config (multiple areas + filters)
npx tsx .claude/skills/discover/scripts/run.ts \
  --config .claude/skills/discover/sample-input.json
```

# Out of scope for this skill

- Chain detection (Phase 1.5 enrichment skill handles this)
- Website quality scoring (later phase)
- Writing cold messages (enrichment skill)
