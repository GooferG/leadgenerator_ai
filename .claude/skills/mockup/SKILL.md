---
name: mockup
description: Generate templated landing-page mockups for `enriched` leads. Each mockup gets a public URL that can be sent in outreach. Use when the user wants to create mockup pages for a batch of enriched leads.
---

# When to use

Trigger when the user says something like "build mockups for the new batch" or "make landing pages for the enriched roofers." Don't trigger for general questions; this is for processing leads where `status='enriched'`.

# Inputs

All optional — sensible defaults applied:

- `batch_size` (default 10): how many leads to process in one run
- `niche` (default `null`): only process leads matching this niche
- `area_label` (default `null`): only process leads from this area

# Process

1. `GET /api/leads?status=enriched&scope=all&limit=<batch_size>` (with optional niche / area filters)
2. For each lead, derive template props from the latest enrichment + lead row
3. POST to `/api/mockups` — the API persists, generates a slug, and bumps `lead.status='mockup_ready'`
4. Print summary: `{ processed, created, failed }` and the public URLs

# Auth

- `HOOK_SERVICE_API_KEY` — sent as `x-hook-service-key`
- `HOOK_API_BASE_URL` — defaults to `http://localhost:3000`; set to your Vercel URL for prod
- `HOOK_PUBLIC_BASE_URL` (optional) — base URL the API stamps onto returned `public_url`. Defaults to the request origin when unset.

# Running

```sh
# All enriched leads (capped at default batch size)
npx tsx .claude/skills/mockup/scripts/run.ts

# Larger batch
npx tsx .claude/skills/mockup/scripts/run.ts --batch-size 30

# Scoped to a niche + area
npx tsx .claude/skills/mockup/scripts/run.ts --niche roofer --area-label "Glendale, AZ"
```

# Out of scope for v1

- Multiple templates (Tier 3) — single `local-service` template handles all niches
- Real photography (placeholder gradient blocks for now)
- Interactive form / calendar booking on the mockup page
- Custom domain mockups (`hook-app.vercel.app/m/<slug>` only for v1)
