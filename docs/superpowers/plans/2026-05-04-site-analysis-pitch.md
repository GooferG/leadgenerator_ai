# Site Analysis & Pitch Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scrape a lead's website homepage and feed real content to Claude so it produces specific site audit findings and a structured pitch instead of guessing from the URL alone.

**Architecture:** A new `/api/scrape` endpoint fetches and parses homepage HTML server-side; `/api/score` accepts optional scraped content and switches to full-analysis prompt mode when present; the frontend calls scrape → score sequentially with phase-aware loading states.

**Tech Stack:** Next.js App Router API routes, Anthropic SDK (claude-haiku), native `fetch` + regex HTML parsing (no new packages), React state, Tailwind CSS, Supabase.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/api/scrape/route.ts` | **Create** | Fetch URL, extract HTML signals, return structured content or error |
| `src/app/api/score/route.ts` | **Modify** | Accept `siteContent`, switch prompt mode, add `siteAudit`/`pitchBullets` fields |
| `src/types/lead.ts` | **Modify** | Add `SiteContent`, extend `ScoreResult` and `Lead` types |
| `src/app/api/leads/[id]/route.ts` | **Modify** | Accept `site_audit` and `scrape_error` in PATCH |
| `src/app/search/search-client.tsx` | **Modify** | Two-phase loading, scrape-error notice, render pitchBullets + collapsible audit |
| `src/app/leads/[id]/score-button.tsx` | **Modify** | Two-phase loading, scrape-error notice, pass siteContent to score |

---

## Task 1: Add types

**Files:**
- Modify: `src/types/lead.ts`

- [ ] **Step 1: Update `src/types/lead.ts`**

Replace the entire file with:

```ts
export type Score = 'hot' | 'warm' | 'cold'
export type LeadStatus = 'new' | 'contacted' | 'converted'

// Shape returned by GET /api/search (mapped from Google Places)
export interface PlaceResult {
  placeId: string
  name: string
  address: string
  phone: string | null
  website: string | null
  rating: number | null
  reviewCount: number | null
  mapsUrl: string
}

// Structured content extracted from a scraped homepage
export interface SiteContent {
  title: string | null
  description: string | null
  hasViewport: boolean
  ogTags: Record<string, string>
  bodyText: string
}

// Shape returned by POST /api/score (from Claude)
export interface ScoreResult {
  score: Score
  scoreLabel: string
  reasoning: string
  pitch: string
  pitchBullets?: string[]
  siteAudit?: string[]
  scrapeError?: boolean
}

// Shape of a row in the Supabase leads table
export interface Lead {
  id: string
  user_id: string
  place_id: string | null
  name: string
  address: string | null
  phone: string | null
  website: string | null
  score: Score | null
  score_label: string | null
  reasoning: string | null
  pitch: string | null
  status: LeadStatus
  notes: string | null
  maps_url: string | null
  site_audit: string[] | null
  scrape_error: boolean | null
  created_at: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/lead.ts
git commit -m "feat: add SiteContent type and extend ScoreResult/Lead with audit fields"
```

---

## Task 2: Create `/api/scrape` endpoint

**Files:**
- Create: `src/app/api/scrape/route.ts`

- [ ] **Step 1: Create `src/app/api/scrape/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { SiteContent } from '@/types/lead'

type ScrapeError = 'timeout' | 'blocked' | 'unreachable'

function extractMeta(html: string, name: string): string | null {
  const m = html.match(
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')
  ) ?? html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i')
  )
  return m?.[1] ?? null
}

function extractOgTag(html: string, property: string): string | null {
  const m = html.match(
    new RegExp(`<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`, 'i')
  ) ?? html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${property}["']`, 'i')
  )
  return m?.[1] ?? null
}

function parseHtml(html: string): SiteContent {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const title = titleMatch?.[1]?.trim() ?? null

  const description = extractMeta(html, 'description')
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html)

  const ogTags: Record<string, string> = {}
  const ogTitle = extractOgTag(html, 'title')
  const ogDesc = extractOgTag(html, 'description')
  if (ogTitle) ogTags['og:title'] = ogTitle
  if (ogDesc) ogTags['og:description'] = ogDesc

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const bodyRaw = bodyMatch?.[1] ?? html
  const bodyText = bodyRaw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000)

  return { title, description, hasViewport, ogTags, bodyText }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.approved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { url } = await req.json()

  if (!url || !(/^https?:\/\//i.test(url))) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadScout/1.0)' },
    })

    if (!res.ok) {
      const scrapeError: ScrapeError = 'blocked'
      return NextResponse.json({ error: scrapeError })
    }

    const html = await res.text()
    const content = parseHtml(html)
    return NextResponse.json({ content })
  } catch (err: unknown) {
    let scrapeError: ScrapeError = 'unreachable'
    if (err instanceof Error && err.name === 'AbortError') {
      scrapeError = 'timeout'
    }
    return NextResponse.json({ error: scrapeError })
  }
}
```

- [ ] **Step 2: Verify the endpoint exists**

Run the dev server (`npm run dev`) and confirm no TypeScript errors on startup.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/scrape/route.ts
git commit -m "feat: add /api/scrape endpoint for homepage HTML extraction"
```

---

## Task 3: Update `/api/score` for full-analysis mode

**Files:**
- Modify: `src/app/api/score/route.ts`

- [ ] **Step 1: Replace `src/app/api/score/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { anthropic } from '@/lib/anthropic'
import { ScoreResult, SiteContent } from '@/types/lead'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.approved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { name, businessType, address, website, phone, rating, reviewCount, siteContent } =
    body as {
      name: string
      businessType: string
      address: string
      website: string | null
      phone: string | null
      rating: number | null
      reviewCount: number | null
      siteContent?: SiteContent
    }

  const hasSiteContent = !!siteContent

  const basePrompt = `You help freelance web developers identify local businesses that need a new website.
Analyze this business and score the lead opportunity.

Business: ${name}
Type: ${businessType}
Location: ${address}
Website: ${website ?? 'none'}
Phone: ${phone ?? 'none'}
Google rating: ${rating ?? 'unknown'}${reviewCount ? ` (${reviewCount} reviews)` : ''}

Scoring criteria:
- hot: no website at all, or clearly broken/placeholder site
- warm: has a website but it looks outdated, low-quality, or not mobile-friendly
- cold: has a modern, functional website — unlikely to need help`

  const siteSection = hasSiteContent
    ? `\n\nScraped site content:
Title: ${siteContent.title ?? 'none'}
Meta description: ${siteContent.description ?? 'none'}
Has viewport meta tag: ${siteContent.hasViewport}
OG title: ${siteContent.ogTags['og:title'] ?? 'none'}
OG description: ${siteContent.ogTags['og:description'] ?? 'none'}
Body text (truncated): ${siteContent.bodyText}`
    : ''

  const outputShape = hasSiteContent
    ? `{
  "score": "hot" | "warm" | "cold",
  "scoreLabel": "<4-6 word label>",
  "reasoning": "<1-2 sentences explaining the score based on the actual site content>",
  "pitch": "<A conversational opener paragraph referencing specific things found on their site. Mention concrete weaknesses. Then naturally work in that the developer has been doing freelance web work for a while — WordPress builds, migrations, and modern headless setups — and has a technical support background so they can handle post-launch issues too. Keep it human, not salesy.>",
  "pitchBullets": ["<Specific improvement 1>", "<Specific improvement 2>", "<Specific improvement 3>"],
  "siteAudit": ["<Specific finding 1>", "<Specific finding 2>", "<Specific finding 3 — up to 5>"]
}`
    : `{
  "score": "hot" | "warm" | "cold",
  "scoreLabel": "<4-6 word label, e.g. No website found>",
  "reasoning": "<1-2 sentences explaining the score>",
  "pitch": "<A 2-3 sentence cold outreach opener tailored to this specific business. Open with something relevant to their situation (e.g. missing website, outdated design). Then naturally work in that the developer has been doing freelance web work for a while — WordPress builds, migrations, and modern headless setups — and has a technical support background so they can handle post-launch issues too. Keep it conversational and human, not salesy.>"
}`

  const prompt = `${basePrompt}${siteSection}

Respond ONLY with valid JSON, no markdown:
${outputShape}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text
    const text = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    const result: ScoreResult = JSON.parse(text)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Score error:', err)
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/score/route.ts
git commit -m "feat: extend /api/score with full-analysis mode using scraped site content"
```

---

## Task 4: Update `/api/leads/[id]` PATCH to persist audit fields

**Files:**
- Modify: `src/app/api/leads/[id]/route.ts`

- [ ] **Step 1: Add `site_audit` and `scrape_error` to the update block**

In `src/app/api/leads/[id]/route.ts`, find the `update` object block (lines 30–37) and replace it:

```ts
  const update: Record<string, unknown> = {}
  if (body.status !== undefined) update.status = body.status
  if (body.notes !== undefined) update.notes = body.notes
  if (body.score !== undefined) update.score = body.score
  if (body.score_label !== undefined) update.score_label = body.score_label
  if (body.reasoning !== undefined) update.reasoning = body.reasoning
  if (body.pitch !== undefined) update.pitch = body.pitch
  if (body.site_audit !== undefined) update.site_audit = body.site_audit
  if (body.scrape_error !== undefined) update.scrape_error = body.scrape_error
```

Note: change the type from `Record<string, string | null>` to `Record<string, unknown>` to accommodate the `string[]` audit array.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/leads/[id]/route.ts
git commit -m "feat: persist site_audit and scrape_error in leads PATCH endpoint"
```

---

## Task 5: Update `search-client.tsx` — scrape + score flow and new UI

**Files:**
- Modify: `src/app/search/search-client.tsx`

- [ ] **Step 1: Add scrape state and two-phase `handleScore`**

At the top of the component, replace the existing `scoringId` state and `handleScore` function with:

```ts
  const [scoringId, setScoringId] = useState<string | null>(null)
  const [scoringPhase, setScoringPhase] = useState<'crawling' | 'scoring' | null>(null)
  const [scrapeNotices, setScrapeNotices] = useState<Record<string, string>>({})
```

Replace the `handleScore` function:

```ts
  async function handleScore(result: ScoredResult) {
    setScoringId(result.placeId)
    setScoringPhase(null)
    setScoreErrors((prev) => {
      const next = { ...prev }
      delete next[result.placeId]
      return next
    })
    setScrapeNotices((prev) => {
      const next = { ...prev }
      delete next[result.placeId]
      return next
    })

    let siteContent = undefined

    if (result.website) {
      setScoringPhase('crawling')
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: result.website }),
      })
      const scrapeData = await scrapeRes.json()

      if (scrapeData.error) {
        setScrapeNotices((prev) => ({
          ...prev,
          [result.placeId]: "Couldn't crawl site — scoring with available data instead",
        }))
      } else {
        siteContent = scrapeData.content
      }
    }

    setScoringPhase('scoring')

    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...result, businessType, siteContent }),
    })

    setScoringId(null)
    setScoringPhase(null)

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }))
      setScoreErrors((prev) => ({
        ...prev,
        [result.placeId]: body.error ?? 'Scoring failed',
      }))
      return
    }

    const scoreData: ScoreResult = await res.json()
    setResults((prev) =>
      prev.map((r) =>
        r.placeId === result.placeId ? { ...r, scoreData } : r
      )
    )

    const leadId = savedLeadIds[result.placeId]
    if (leadId) {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: scoreData.score,
          score_label: scoreData.scoreLabel,
          reasoning: scoreData.reasoning,
          pitch: scoreData.pitch,
          site_audit: scoreData.siteAudit ?? null,
          scrape_error: scoreData.scrapeError ?? null,
        }),
      })
    }
  }
```

- [ ] **Step 2: Update the Score button label to show phase**

Find the Score button in the JSX (the `!scored &&` block) and replace the button content:

```tsx
                    {!scored && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleScore(result)}
                        disabled={isScoring}
                      >
                        {isScoring
                          ? scoringPhase === 'crawling'
                            ? 'Crawling…'
                            : 'Scoring…'
                          : '✦ Score'}
                      </Button>
                    )}
```

- [ ] **Step 3: Add scrape notice and new score card sections**

Find the `{scored && (` block and replace it with the extended version that includes pitchBullets and the collapsible Site Audit:

```tsx
                {scrapeNotices[result.placeId] && (
                  <div className="mt-2 text-xs text-yellow-400/80 bg-yellow-900/10 border border-yellow-900/30 rounded-lg px-3 py-2">
                    {scrapeNotices[result.placeId]}
                  </div>
                )}

                {scored && (
                  <div className="mt-3 pt-3 border-t border-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                          scored.score === 'hot'
                            ? 'bg-amber-900/40 text-amber-400 border-amber-800/50'
                            : scored.score === 'warm'
                            ? 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50'
                            : 'bg-blue-900/40 text-blue-400 border-blue-800/50'
                        }`}
                      >
                        {scored.score}
                      </span>
                      <span className="text-xs text-zinc-400">{scored.scoreLabel}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mb-2.5">{scored.reasoning}</p>
                    <div className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg px-3 py-2.5 text-xs text-zinc-300 italic mb-2.5">
                      &ldquo;{scored.pitch}&rdquo;
                    </div>
                    {scored.pitchBullets && scored.pitchBullets.length > 0 && (
                      <ul className="mb-2.5 pl-4 list-disc space-y-1">
                        {scored.pitchBullets.map((bullet, i) => (
                          <li key={i} className="text-xs text-zinc-400">{bullet}</li>
                        ))}
                      </ul>
                    )}
                    {scored.siteAudit && scored.siteAudit.length > 0 && (
                      <details className="group">
                        <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors list-none flex items-center gap-1">
                          <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                          Site Audit ({scored.siteAudit.length} findings)
                        </summary>
                        <ul className="mt-2 pl-4 list-disc space-y-1">
                          {scored.siteAudit.map((finding, i) => (
                            <li key={i} className="text-xs text-zinc-500">{finding}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
```

- [ ] **Step 4: Add `SiteContent` import to the imports line**

The `SiteContent` type isn't needed directly in this file (it's passed through), so no import change is required. Verify the existing import still covers `ScoreResult`:

```ts
import { PlaceResult, ScoreResult } from '@/types/lead'
```

- [ ] **Step 5: Commit**

```bash
git add src/app/search/search-client.tsx
git commit -m "feat: two-phase score flow with site crawling, audit display, and pitch bullets in search UI"
```

---

## Task 6: Update `score-button.tsx` — scrape + score flow

**Files:**
- Modify: `src/app/leads/[id]/score-button.tsx`

- [ ] **Step 1: Replace `src/app/leads/[id]/score-button.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ScoreButton({
  lead,
}: {
  lead: {
    id: string
    name: string
    address: string | null
    website: string | null
    phone: string | null
  }
}) {
  const router = useRouter()
  const [phase, setPhase] = useState<'crawling' | 'scoring' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scrapeNotice, setScrapeNotice] = useState<string | null>(null)

  async function handleScore() {
    setPhase(null)
    setError(null)
    setScrapeNotice(null)

    let siteContent = undefined

    if (lead.website) {
      setPhase('crawling')
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: lead.website }),
      })
      const scrapeData = await scrapeRes.json()

      if (scrapeData.error) {
        setScrapeNotice("Couldn't crawl site — scoring with available data instead")
      } else {
        siteContent = scrapeData.content
      }
    }

    setPhase('scoring')

    const scoreRes = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: lead.name,
        address: lead.address,
        website: lead.website,
        phone: lead.phone,
        businessType: '',
        siteContent,
      }),
    })

    if (!scoreRes.ok) {
      const body = await scoreRes.json().catch(() => ({ error: 'Scoring failed' }))
      setError(body.error ?? 'Scoring failed')
      setPhase(null)
      return
    }

    const scoreData = await scoreRes.json()

    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score: scoreData.score,
        score_label: scoreData.scoreLabel,
        reasoning: scoreData.reasoning,
        pitch: scoreData.pitch,
        site_audit: scoreData.siteAudit ?? null,
        scrape_error: scoreData.scrapeError ?? null,
      }),
    })

    setPhase(null)
    router.refresh()
  }

  const loading = phase !== null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          onClick={handleScore}
          disabled={loading}
          className="text-sm px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-50 transition-colors"
        >
          {phase === 'crawling'
            ? 'Crawling site…'
            : phase === 'scoring'
            ? 'Scoring…'
            : '✦ Score with AI'}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
      {scrapeNotice && (
        <p className="text-xs text-yellow-400/80">{scrapeNotice}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/leads/[id]/score-button.tsx
git commit -m "feat: two-phase score flow with site crawling in lead detail score button"
```

---

## Task 7: Verify lead detail page renders audit fields

**Files:**
- Read: `src/app/leads/[id]/page.tsx` (or equivalent server component)

- [ ] **Step 1: Check if the lead detail page renders `pitch` and `reasoning`**

Read the lead detail page file. Identify where `reasoning` and `pitch` are rendered.

- [ ] **Step 2: Add `pitchBullets` and collapsible audit rendering**

In the lead detail page, after wherever `pitch` is rendered, add:

```tsx
{lead.site_audit && lead.site_audit.length > 0 && (
  <details className="group mt-3">
    <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors list-none flex items-center gap-1">
      <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
      Site Audit ({lead.site_audit.length} findings)
    </summary>
    <ul className="mt-2 pl-4 list-disc space-y-1">
      {lead.site_audit.map((finding: string, i: number) => (
        <li key={i} className="text-xs text-zinc-500">{finding}</li>
      ))}
    </ul>
  </details>
)}
{lead.scrape_error && (
  <p className="text-xs text-yellow-400/80 mt-2">
    Site couldn&apos;t be crawled when this lead was scored — audit data unavailable.
  </p>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/leads/[id]/page.tsx
git commit -m "feat: show site audit and scrape error notice on lead detail page"
```

---

## Task 8: Smoke test end-to-end

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Confirm no TypeScript errors in terminal output.

- [ ] **Step 2: Test with a lead that has a website**

1. Go to `/search`, search for a business type and location
2. Find a result with a website URL
3. Click **✦ Score** — verify button shows "Crawling…" then "Scoring…"
4. After completion verify: score badge, reasoning, pitch paragraph, pitch bullets, and Site Audit collapsible all appear
5. Expand Site Audit — verify findings are specific to the site (not generic)

- [ ] **Step 3: Test fallback (blocked site)**

1. Manually edit a lead's website field to `https://example.com` (likely blocked) or use a known Cloudflare-protected URL
2. Score it — verify the yellow fallback notice appears and scoring still completes

- [ ] **Step 4: Test with no website**

1. Find or create a lead with no website
2. Score it — verify no "Crawling…" phase, scoring proceeds immediately, no audit section appears

- [ ] **Step 5: Test lead detail page**

1. Save a scored lead with audit data
2. Navigate to `/leads/[id]` — verify Site Audit collapsible appears with the persisted findings

- [ ] **Step 6: Final commit if any fixes were made during smoke test**

```bash
git add -A
git commit -m "fix: smoke test corrections for site analysis flow"
```
