# Site Analysis & Pitch Improvement — Design Spec

**Date:** 2026-05-04  
**Status:** Approved

---

## Problem

The current scoring flow only knows whether a business has a website URL or not. Claude infers site quality from the URL string + business metadata alone. This produces generic pitches that don't reference specific weaknesses — limiting the value for a small digital agency pitching cold.

## Goal

When a lead has a website, scrape its homepage and give Claude real content to work with. Output a structured pitch (opener + improvement bullets) and a collapsible site audit the dev can reference during outreach.

---

## Architecture & Data Flow

Two sequential API calls replace the current single `/api/score` call:

```
Client
  → POST /api/scrape  { url }
      ← { content } | { error: "timeout" | "blocked" | "unreachable" }

  → POST /api/score   { ...businessData, siteContent? }
      ← { score, scoreLabel, reasoning, pitch, pitchBullets?, siteAudit?, scrapeError? }
```

- If no website: skip scrape, call score directly (current behavior)
- If scrape fails: show inline fallback message, call score without `siteContent` (current behavior + `scrapeError: true` in response)
- If scrape succeeds: pass `siteContent` to score for full analysis mode

---

## Section 1: Supabase Schema Changes

Two nullable columns added to the `leads` table:

```sql
ALTER TABLE leads
  ADD COLUMN site_audit  jsonb    DEFAULT NULL,
  ADD COLUMN scrape_error boolean DEFAULT NULL;
```

**`site_audit`** — stores the array of audit finding strings returned by Claude. Persists so the user sees findings when revisiting a saved lead without re-scraping.

**`scrape_error`** — boolean flag. `true` means the site was present but couldn't be crawled. UI uses this to show the fallback notice on saved leads.

### Instructions to apply in Supabase

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New query**
4. Paste and run:

```sql
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS site_audit  jsonb    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS scrape_error boolean DEFAULT NULL;
```

5. Verify in **Table Editor → leads** that both columns appear
6. No RLS changes needed — columns inherit existing row-level security

---

## Section 2: `/api/scrape` Endpoint

**File:** `src/app/api/scrape/route.ts`  
**Method:** POST  
**Auth:** Requires approved session (same guard as `/api/score`)

### Input
```ts
{ url: string }
```

### Logic
1. Validate URL — must start with `http://` or `https://`. Reject otherwise.
2. `fetch(url, { signal: AbortSignal.timeout(5000) })` — 5s hard timeout
3. Parse response HTML (no extra packages — native string/regex extraction):
   - `<title>` tag content
   - `<meta name="description" content="...">` 
   - Presence of `<meta name="viewport">` (boolean)
   - OG tags: `og:title`, `og:description`
   - Strip all HTML tags from `<body>`, collapse whitespace, truncate to 2000 chars
4. Return `{ content: { title, description, hasViewport, ogTags, bodyText } }`
5. On any failure (network error, timeout, non-200, parse error): return `{ error: "timeout" | "blocked" | "unreachable" }` with HTTP 200 — client decides how to handle, not an error response

### Error classification
- `AbortError` → `"timeout"`
- HTTP 4xx/5xx (403, 429, etc.) → `"blocked"`
- Network failure, DNS error → `"unreachable"`

---

## Section 3: `/api/score` Prompt Changes

**File:** `src/app/api/score/route.ts`

### New input field
```ts
siteContent?: {
  title: string | null
  description: string | null
  hasViewport: boolean
  ogTags: Record<string, string>
  bodyText: string
}
```

### Full analysis mode prompt additions (when `siteContent` present)

Append to existing prompt:

```
Scraped site content:
Title: ${title ?? 'none'}
Meta description: ${description ?? 'none'}
Has viewport meta tag: ${hasViewport}
Body text (truncated): ${bodyText}
```

### New output fields (full analysis mode only)

```json
{
  "score": "hot" | "warm" | "cold",
  "scoreLabel": "...",
  "reasoning": "1-2 sentences",
  "pitch": "Conversational opener paragraph referencing specific site findings",
  "pitchBullets": ["Improvement point 1", "Improvement point 2", "Improvement point 3"],
  "siteAudit": ["Finding 1", "Finding 2", "Finding 3"]
}
```

**`siteAudit`** — 2-5 specific findings (e.g. "No viewport meta tag — site likely broken on mobile", "Meta description missing — hurts search visibility", "No clear call-to-action found in homepage copy")

**`pitchBullets`** — 2-3 actionable improvements the dev can reference in the call/email (e.g. "Mobile-friendly redesign with proper viewport and responsive layout", "SEO basics: meta descriptions, title tags, and sitemap")

**`max_tokens`** bumped from 300 → 700.

### Fallback mode (no `siteContent`)
Prompt and output unchanged from current behavior. Response includes `scrapeError: true` so UI can display the fallback notice.

---

## Section 4: Type Changes

**File:** `src/types/lead.ts`

`ScoreResult` gains:
```ts
siteAudit?: string[]
pitchBullets?: string[]
scrapeError?: boolean
```

`Lead` gains:
```ts
site_audit?: string[] | null
scrape_error?: boolean | null
```

---

## Section 5: Frontend Changes

### `score-button.tsx` (and search-client equivalent)

Two-phase loading state replacing single spinner:

1. **"Crawling site..."** — while `/api/scrape` runs (only when `website` is present)
2. **"Scoring lead..."** — while `/api/score` runs

If scrape returns `error`:
- Show inline notice: _"Couldn't crawl site — scoring with available data instead"_
- Proceed to score without `siteContent` (fallback mode)

### Score card UI

Existing `reasoning` and `pitch` blocks unchanged in position.

**New: `pitchBullets`** — rendered as a bulleted list immediately below the `pitch` paragraph. Only shown when present.

**New: collapsible "Site Audit" section** — collapsed by default, expands to show `siteAudit` as a bullet list. Only rendered when `siteAudit` is present. Use a native `<details>`/`<summary>` element or a simple toggle state — no new UI library needed.

### DB save (`/api/leads/[id]` PATCH)

Payload gains:
```ts
site_audit: result.siteAudit ?? null,
scrape_error: result.scrapeError ?? null,
```

---

## Out of Scope

- Multi-page crawling
- JS rendering / headless browser
- Caching scraped content across sessions
- Re-scraping on lead revisit (audit shown from DB)
