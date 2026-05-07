---
name: enrich
description: Score and enrich `discovered` leads with a marketing diagnosis, site brief, and cold-open message via Claude. Use when the user wants to process a batch of unenriched leads.
---

# When to use

Trigger when the user says something like "enrich the new leads", "score the West Austin batch", or "run enrichment on the discovered leads". Don't trigger for general questions; this is for processing leads where `status='discovered'`.

# Inputs

All optional — sensible defaults applied:

- `batch_size` (default 5): how many leads to process in one run
- `niche` (default `null`): only process leads matching this niche
- `area_label` (default `null`): only process leads from this area

# Process

1. `GET /api/leads?status=discovered&scope=all&limit=<batch_size>` (with optional `niche` / `area_label` filters)
2. For each lead, call Claude (Sonnet 4.6) with a senior-local-marketing-strategist prompt that returns structured JSON
3. If Claude flags the lead as a national chain → archive it via `/api/enrichments` with `chain_flag_reason` set; the API will set `lead.status='archived', is_chain=true`
4. Otherwise → POST diagnosis + site_brief + cold_message; the API will set `lead.status='enriched'`
5. Print a summary: `{ processed, enriched, archived_chains, failed }`

# Auth

- `HOOK_SERVICE_API_KEY` — sent as `x-hook-service-key` header on the GET and POST
- `ANTHROPIC_API_KEY` — used for the Claude call
- `HOOK_API_BASE_URL` — defaults to `http://localhost:3000`; set to your Vercel URL for prod

# Running

```sh
# Default: 5 leads, any niche/area
npx tsx .claude/skills/enrich/scripts/run.ts

# Larger batch
npx tsx .claude/skills/enrich/scripts/run.ts --batch-size 20

# Scoped to a niche + area
npx tsx .claude/skills/enrich/scripts/run.ts --niche cosmetic-dentist --area-label "West Austin"
```

# Out of scope for v1

- Website scraping (Claude works from name + address + rating + reviews alone for now; layer in later if outputs look shallow)
- Parallel processing (sequential keeps logs clear and respects Anthropic rate limits)
- Re-enrichment of already-enriched leads (skill only pulls `status='discovered'`)
- Mockup creation (Phase 2)
