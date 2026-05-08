---
name: video
description: Record a Playwright walkthrough of each `mockup_ready` lead's mockup page and upload the MP4 to Supabase Storage. Use when the user wants to generate video walkthroughs for a batch of mockups.
---

# When to use

Trigger when the user says something like "record videos for the new batch" or "generate walkthroughs for these mockups." Don't trigger for general questions; this is for processing leads where `status='mockup_ready'`.

# Inputs

All optional — sensible defaults applied:

- `batch_size` (default 5): how many leads to process in one run
- `niche` (default `null`): only process leads matching this niche
- `area_label` (default `null`): only process leads from this area

# Process

For each lead with `status='mockup_ready'`:

1. Fetch the lead + its latest mockup from Hook
2. Launch headless Chromium (Playwright) at 1280x800, ~720p record
3. Navigate to the mockup's public URL
4. Run the scripted scroll sequence (~15s):
   - Settle on hero (3s)
   - Slow scroll to services (2s + 2s pause)
   - Slow scroll to CTA (3s + 2s pause)
   - Scroll back to top (2s)
5. Stop recording, transcode WebM → MP4 with bundled ffmpeg
6. Upload MP4 to Supabase Storage `mockup-videos` bucket
7. POST metadata to `/api/videos` (records row, bumps `lead.status='video_ready'`)
8. Print public URL

# Auth

- `HOOK_SERVICE_API_KEY` — service-key auth on Hook API calls
- `NEXT_PUBLIC_SUPABASE_URL` — supabase project base URL
- `SUPABASE_SERVICE_ROLE_KEY` — for direct Storage upload (skill-side)
- `HOOK_API_BASE_URL` — defaults to `http://localhost:3000`; set to your Vercel URL when running against prod

# Running

```sh
# Default: 5 mockup_ready leads
npx tsx .claude/skills/video/scripts/run.ts

# Larger batch
npx tsx .claude/skills/video/scripts/run.ts --batch-size 10

# Scoped
npx tsx .claude/skills/video/scripts/run.ts --niche roofer
```

# Setup notes

- **Playwright browser binary**: requires a one-time `npx playwright install chromium`. Bundled ffmpeg is included via `@ffmpeg-installer/ffmpeg` — no system install needed.
- **Local cache**: temporary `.cache/videos/` directory in the repo (gitignored). Cleaned per-run.
- **Supabase bucket**: `mockup-videos`, public-read, 20MB cap, MP4/WebM only. Already created in prod.

# Out of scope for v1

- Captions / overlays
- Music
- Cursor or annotation effects
- Mobile viewport recording (desktop only)
- Re-recording already-recorded leads (skill only pulls `status='mockup_ready'`)
