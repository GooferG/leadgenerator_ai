# Lead Generator Phase 2: Search & AI Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google Places search, Claude AI lead scoring, and a full lead management UI to the Lead Generator app.

**Architecture:** Server Components fetch Supabase directly; Client Components call `/api/*` routes which proxy Google Places and Claude APIs (keys never reach the browser). Shared TypeScript types keep the data shape consistent across the stack.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind, shadcn/ui, `@anthropic-ai/sdk`, Supabase, Google Places API (New), Claude Haiku

---

## File Map

| File | Status | Responsibility |
|------|--------|---------------|
| `supabase/migrations/002_add_place_id.sql` | Create | Add `place_id` column + unique constraint to leads |
| `src/types/lead.ts` | Create | Shared TS types: `PlaceResult`, `ScoreResult`, `Lead` |
| `src/lib/anthropic.ts` | Create | Anthropic client singleton |
| `src/lib/places.ts` | Create | Google Places Text Search helper |
| `src/components/nav.tsx` | Create | Top nav bar (Server Component) |
| `src/app/layout.tsx` | Modify | Render Nav for approved users |
| `src/app/api/search/route.ts` | Create | POST — calls Places API |
| `src/app/api/score/route.ts` | Create | POST — calls Claude |
| `src/app/api/leads/route.ts` | Create | GET + POST — fetch/save leads |
| `src/app/api/leads/[id]/route.ts` | Create | PATCH — update status/notes |
| `src/app/dashboard/page.tsx` | Replace | Stat cards + filtered leads list |
| `src/app/search/page.tsx` | Create | Server wrapper — fetches saved placeIds |
| `src/app/search/search-client.tsx` | Create | Client Component — form, results, score, save |
| `src/app/leads/[id]/page.tsx` | Create | Lead detail — Server Component |
| `src/app/leads/[id]/lead-actions.tsx` | Create | Client Component — status/notes editing |

---

## Task 1: External setup, dependencies, env vars, migration

**Files:**
- Modify: `.env.local.example`
- Modify: `.env.local`
- Create: `supabase/migrations/002_add_place_id.sql`

- [ ] **Step 1: Get your Anthropic API key**

Go to https://console.anthropic.com → API Keys → Create Key. Copy the key (starts with `sk-ant-`).

- [ ] **Step 2: Add ANTHROPIC_API_KEY to env files**

Add this line to `.env.local.example`:
```
# Anthropic — get from console.anthropic.com
ANTHROPIC_API_KEY=
```

Add your actual key to `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
```

Also confirm `GOOGLE_PLACES_API_KEY` is filled in `.env.local` (it was listed but left empty in Phase 1).

- [ ] **Step 3: Install Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

Expected: `added N packages`

- [ ] **Step 4: Create the Supabase migration file**

Create `supabase/migrations/002_add_place_id.sql`:

```sql
-- Add place_id to track which Google Place each lead came from
alter table leads add column if not exists place_id text;

-- Prevent a user from saving the same business twice
create unique index if not exists leads_user_place_unique
  on leads(user_id, place_id)
  where place_id is not null;
```

- [ ] **Step 5: Apply migration in Supabase**

1. Go to your Supabase project → SQL Editor → New query
2. Paste the contents of `002_add_place_id.sql` and click Run
3. Expected: "Success. No rows returned"

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add Anthropic SDK, ANTHROPIC_API_KEY env var, place_id migration"
```

---

## Task 2: Shared TypeScript types

**Files:**
- Create: `src/types/lead.ts`

- [ ] **Step 1: Create the types file**

Create `src/types/lead.ts`:

```typescript
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

// Shape returned by POST /api/score (from Claude)
export interface ScoreResult {
  score: Score
  scoreLabel: string
  reasoning: string
  pitch: string
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
  created_at: string
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/lead.ts
git commit -m "feat: add shared TypeScript types for leads"
```

---

## Task 3: Anthropic client and Places API helper

**Files:**
- Create: `src/lib/anthropic.ts`
- Create: `src/lib/places.ts`

- [ ] **Step 1: Create the Anthropic client**

Create `src/lib/anthropic.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'

// Singleton client — imported by API routes only (server-side)
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})
```

- [ ] **Step 2: Create the Places API helper**

Create `src/lib/places.ts`:

```typescript
import { PlaceResult } from '@/types/lead'

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText'

// Only request the fields we need — Google charges per field group
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
].join(',')

export async function searchPlaces(
  businessType: string,
  location: string
): Promise<PlaceResult[]> {
  const res = await fetch(PLACES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: `${businessType} in ${location}`,
      maxResultCount: 20,
    }),
  })

  if (!res.ok) {
    throw new Error(`Places API error: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()

  return (data.places ?? []).map((p: any): PlaceResult => ({
    placeId: p.id,
    name: p.displayName?.text ?? 'Unknown',
    address: p.formattedAddress ?? '',
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? null,
    mapsUrl: p.googleMapsUri ?? '',
  }))
}
```

> **Note:** Radius filtering requires geocoding the location string to lat/lng first (Google won't do it automatically). For Phase 2 the radius selector exists in the UI but the text query naturally scopes to the location. Proper radius filtering is a Phase 3 enhancement.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/anthropic.ts src/lib/places.ts
git commit -m "feat: add Anthropic client and Google Places search helper"
```

---

## Task 4: Nav component and layout update

**Files:**
- Create: `src/components/nav.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create the Nav component**

Create `src/components/nav.tsx`:

```typescript
import Link from 'next/link'
import { signOut } from '@/auth'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface NavProps {
  userRole: 'user' | 'admin'
}

export function Nav({ userRole }: NavProps) {
  return (
    <nav className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between shrink-0">
      <Link href="/dashboard" className="font-bold text-sm">
        Lead Generator
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Dashboard
        </Link>
        <Link
          href="/search"
          className={cn(
            buttonVariants({ size: 'sm' }),
            'bg-indigo-600 hover:bg-indigo-700 text-white border-0'
          )}
        >
          Search
        </Link>
        {userRole === 'admin' && (
          <Link
            href="/admin"
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Admin
          </Link>
        )}
      </div>
      <form
        action={async () => {
          'use server'
          await signOut({ redirectTo: '/' })
        }}
      >
        <button
          type="submit"
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </form>
    </nav>
  )
}
```

- [ ] **Step 2: Update the root layout to render Nav for approved users**

Replace `src/app/layout.tsx` with:

```typescript
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { auth } from '@/auth'
import { Nav } from '@/components/nav'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Lead Generator',
  description: 'Find local businesses that need websites',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const showNav = session?.user?.approved === true

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {showNav && <Nav userRole={session!.user.role} />}
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/nav.tsx src/app/layout.tsx
git commit -m "feat: add Nav component and wire into root layout"
```

---

## Task 5: POST /api/search route

**Files:**
- Create: `src/app/api/search/route.ts`

- [ ] **Step 1: Create the search API route**

```bash
mkdir -p src/app/api/search
```

Create `src/app/api/search/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { searchPlaces } from '@/lib/places'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.approved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { businessType, location } = await req.json()

  if (!businessType?.trim() || !location?.trim()) {
    return NextResponse.json(
      { error: 'businessType and location are required' },
      { status: 400 }
    )
  }

  try {
    const results = await searchPlaces(businessType.trim(), location.trim())
    return NextResponse.json(results)
  } catch (err) {
    console.error('Places search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/search
git commit -m "feat: add POST /api/search route"
```

---

## Task 6: POST /api/score route

**Files:**
- Create: `src/app/api/score/route.ts`

- [ ] **Step 1: Create the score API route**

```bash
mkdir -p src/app/api/score
```

Create `src/app/api/score/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { anthropic } from '@/lib/anthropic'
import { ScoreResult } from '@/types/lead'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.approved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { name, businessType, address, website, phone, rating, reviewCount } = body

  const prompt = `You help freelance web developers identify local businesses that need a new website.
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
- cold: has a modern, functional website — unlikely to need help

Respond ONLY with valid JSON, no markdown:
{
  "score": "hot" | "warm" | "cold",
  "scoreLabel": "<4-6 word label, e.g. No website found>",
  "reasoning": "<1-2 sentences explaining the score>",
  "pitch": "<1-2 sentence cold outreach opener the developer could use>"
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = (message.content[0] as { type: string; text: string }).text
    const result: ScoreResult = JSON.parse(text)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Score error:', err)
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/score
git commit -m "feat: add POST /api/score route with Claude Haiku scoring"
```

---

## Task 7: Leads API routes (GET, POST, PATCH)

**Files:**
- Create: `src/app/api/leads/route.ts`
- Create: `src/app/api/leads/[id]/route.ts`

- [ ] **Step 1: Create the leads GET + POST route**

```bash
mkdir -p "src/app/api/leads/[id]"
```

Create `src/app/api/leads/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const session = await auth()
  if (!session?.user?.approved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.approved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  const { data, error } = await supabaseAdmin
    .from('leads')
    .insert({
      user_id: session.user.id,
      place_id: body.placeId ?? null,
      name: body.name,
      address: body.address ?? null,
      phone: body.phone ?? null,
      website: body.website ?? null,
      score: body.score ?? null,
      score_label: body.scoreLabel ?? null,
      reasoning: body.reasoning ?? null,
      pitch: body.pitch ?? null,
      maps_url: body.mapsUrl ?? null,
      status: 'new',
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already saved' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
```

- [ ] **Step 2: Create the lead PATCH route**

Create `src/app/api/leads/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.approved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  // Verify ownership before updating
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!lead || lead.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const update: Record<string, string> = {}
  if (body.status !== undefined) update.status = body.status
  if (body.notes !== undefined) update.notes = body.notes

  const { data, error } = await supabaseAdmin
    .from('leads')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/leads
git commit -m "feat: add GET/POST /api/leads and PATCH /api/leads/[id] routes"
```

---

## Task 8: Dashboard page

**Files:**
- Replace: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Replace the dashboard placeholder**

Replace the full contents of `src/app/dashboard/page.tsx`:

```typescript
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Lead, Score, LeadStatus } from '@/types/lead'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SCORE_BADGE: Record<Score, string> = {
  hot: 'bg-green-100 text-green-800',
  warm: 'bg-yellow-100 text-yellow-800',
  cold: 'bg-red-100 text-red-800',
}

const STATUS_BADGE: Record<LeadStatus, string> = {
  new: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  contacted: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  converted: 'bg-green-50 text-green-700 border border-green-200',
}

const FILTERS = ['all', 'hot', 'warm', 'cold', 'contacted', 'converted'] as const

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const session = await auth()
  const { filter } = await searchParams
  const userId = session!.user.id

  const [{ count: total }, { count: hotCount }, { count: contactedCount }] =
    await Promise.all([
      supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('score', 'hot'),
      supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'contacted'),
    ])

  let query = supabaseAdmin
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (filter === 'hot' || filter === 'warm' || filter === 'cold') {
    query = query.eq('score', filter)
  } else if (filter === 'contacted' || filter === 'converted') {
    query = query.eq('status', filter)
  }

  const { data: leads } = await query

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Link
          href="/dashboard"
          className="bg-white border border-slate-200 rounded-lg p-4 text-center hover:border-slate-300 transition-colors"
        >
          <div className="text-2xl font-bold text-slate-900">{total ?? 0}</div>
          <div className="text-sm text-slate-500 mt-1">Total leads</div>
        </Link>
        <Link
          href="/dashboard?filter=hot"
          className="bg-white border border-slate-200 rounded-lg p-4 text-center hover:border-slate-300 transition-colors"
        >
          <div className="text-2xl font-bold text-green-600">{hotCount ?? 0}</div>
          <div className="text-sm text-slate-500 mt-1">Hot leads</div>
        </Link>
        <Link
          href="/dashboard?filter=contacted"
          className="bg-white border border-slate-200 rounded-lg p-4 text-center hover:border-slate-300 transition-colors"
        >
          <div className="text-2xl font-bold text-blue-600">{contactedCount ?? 0}</div>
          <div className="text-sm text-slate-500 mt-1">Contacted</div>
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === 'all' ? '/dashboard' : `/dashboard?filter=${f}`}
            className={cn(
              'px-3 py-1 rounded-full text-sm border transition-colors capitalize',
              filter === f || (!filter && f === 'all')
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            )}
          >
            {f}
          </Link>
        ))}
      </div>

      {/* Leads list */}
      {!leads?.length ? (
        <div className="text-center py-16 text-slate-500">
          <p className="mb-4">
            No leads yet{filter && filter !== 'all' ? ` matching "${filter}"` : ''}.
          </p>
          <Link href="/search" className={buttonVariants()}>
            Search for leads
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {leads.map((lead: Lead) => (
            <Link
              key={lead.id}
              href={`/leads/${lead.id}`}
              className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between hover:border-slate-300 transition-colors"
            >
              <div className="min-w-0">
                <div className="font-medium text-slate-900 truncate">{lead.name}</div>
                <div className="text-sm text-slate-500 truncate">{lead.address}</div>
                {lead.phone && (
                  <div className="text-xs text-slate-400">{lead.phone}</div>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                {lead.score && (
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      SCORE_BADGE[lead.score]
                    )}
                  >
                    {lead.score}
                  </span>
                )}
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    STATUS_BADGE[lead.status]
                  )}
                >
                  {lead.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: implement dashboard with stat cards and filtered leads list"
```

---

## Task 9: Search page

**Files:**
- Create: `src/app/search/page.tsx`
- Create: `src/app/search/search-client.tsx`

- [ ] **Step 1: Create the search directory**

```bash
mkdir -p src/app/search
```

- [ ] **Step 2: Create the Server Component wrapper**

Create `src/app/search/page.tsx`:

```typescript
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { SearchClient } from './search-client'

// Server Component: fetches the user's saved placeIds so the client
// knows which results are already in their pipeline on page load.
export default async function SearchPage() {
  const session = await auth()

  const { data: savedLeads } = await supabaseAdmin
    .from('leads')
    .select('place_id')
    .eq('user_id', session!.user.id)
    .not('place_id', 'is', null)

  const savedPlaceIds = savedLeads?.map((l) => l.place_id as string) ?? []

  return <SearchClient initialSavedPlaceIds={savedPlaceIds} />
}
```

- [ ] **Step 3: Create the SearchClient component**

Create `src/app/search/search-client.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PlaceResult, ScoreResult } from '@/types/lead'

interface ScoredResult extends PlaceResult {
  scoreData?: ScoreResult
}

export function SearchClient({
  initialSavedPlaceIds,
}: {
  initialSavedPlaceIds: string[]
}) {
  const [businessType, setBusinessType] = useState('')
  const [location, setLocation] = useState('')
  const [radius, setRadius] = useState('5mi')
  const [results, setResults] = useState<ScoredResult[]>([])
  const [savedPlaceIds, setSavedPlaceIds] = useState(
    new Set(initialSavedPlaceIds)
  )
  const [scoringId, setScoringId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearching(true)
    setSearchError(null)
    setResults([])
    setHasSearched(true)

    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessType, location, radius }),
    })

    setSearching(false)

    if (!res.ok) {
      setSearchError('Search failed. Check your API key and try again.')
      return
    }

    const data: PlaceResult[] = await res.json()
    setResults(data)
  }

  async function handleScore(result: ScoredResult) {
    setScoringId(result.placeId)

    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...result, businessType }),
    })

    setScoringId(null)

    if (!res.ok) return

    const scoreData: ScoreResult = await res.json()
    setResults((prev) =>
      prev.map((r) =>
        r.placeId === result.placeId ? { ...r, scoreData } : r
      )
    )
  }

  async function handleSave(result: ScoredResult) {
    setSavingId(result.placeId)

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placeId: result.placeId,
        name: result.name,
        address: result.address,
        phone: result.phone,
        website: result.website,
        mapsUrl: result.mapsUrl,
        score: result.scoreData?.score ?? null,
        scoreLabel: result.scoreData?.scoreLabel ?? null,
        reasoning: result.scoreData?.reasoning ?? null,
        pitch: result.scoreData?.pitch ?? null,
      }),
    })

    setSavingId(null)

    // 201 = saved, 409 = already saved — both mean it's in the pipeline
    if (res.ok || res.status === 409) {
      setSavedPlaceIds((prev) => new Set([...prev, result.placeId]))
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Find Leads</h1>

      <form
        onSubmit={handleSearch}
        className="bg-white border border-slate-200 rounded-lg p-4 flex gap-3 mb-6 flex-wrap"
      >
        <input
          type="text"
          placeholder="Business type (e.g. restaurants)"
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          required
          className="flex-1 min-w-[160px] border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="text"
          placeholder="Location (e.g. Tampa, FL)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          className="flex-1 min-w-[160px] border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="1mi">1 mile</option>
          <option value="5mi">5 miles</option>
          <option value="10mi">10 miles</option>
          <option value="25mi">25 miles</option>
        </select>
        <Button type="submit" disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {searchError && (
        <div className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          {searchError}
        </div>
      )}

      {searching && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-lg p-4 animate-pulse"
            >
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {!searching && hasSearched && results.length === 0 && !searchError && (
        <p className="text-slate-500 text-sm text-center py-8">
          No results found. Try a different search.
        </p>
      )}

      {!searching && results.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-500">{results.length} results</p>
          {results.map((result) => {
            const isSaved = savedPlaceIds.has(result.placeId)
            const isScoring = scoringId === result.placeId
            const isSaving = savingId === result.placeId
            const scored = result.scoreData

            return (
              <div
                key={result.placeId}
                className="bg-white border border-slate-200 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{result.name}</div>
                    <div className="text-sm text-slate-500">{result.address}</div>
                    <div className="flex gap-3 mt-1 flex-wrap items-center">
                      {result.phone && (
                        <a
                          href={`tel:${result.phone}`}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          {result.phone}
                        </a>
                      )}
                      {result.website ? (
                        <a
                          href={result.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:underline truncate max-w-[200px]"
                        >
                          {result.website}
                        </a>
                      ) : (
                        <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">
                          No website
                        </span>
                      )}
                      {result.rating && (
                        <span className="text-xs text-slate-400">
                          ⭐ {result.rating} ({result.reviewCount})
                        </span>
                      )}
                      {result.mapsUrl && (
                        <a
                          href={result.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          Maps ↗
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!scored && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleScore(result)}
                        disabled={isScoring}
                      >
                        {isScoring ? '…' : '✦ Score'}
                      </Button>
                    )}
                    {isSaved ? (
                      <span className="text-xs text-green-600 font-medium self-center">
                        Saved ✓
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleSave(result)}
                        disabled={isSaving}
                      >
                        {isSaving ? '…' : '+ Save'}
                      </Button>
                    )}
                  </div>
                </div>

                {scored && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          scored.score === 'hot'
                            ? 'bg-green-100 text-green-800'
                            : scored.score === 'warm'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {scored.score}
                      </span>
                      <span className="text-xs text-slate-500">
                        {scored.scoreLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-2">{scored.reasoning}</p>
                    <div className="bg-slate-50 rounded px-3 py-2 text-xs text-slate-700 italic">
                      &ldquo;{scored.pitch}&rdquo;
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/search
git commit -m "feat: add search page with Places results, Score and Save actions"
```

---

## Task 10: Lead detail page

**Files:**
- Create: `src/app/leads/[id]/page.tsx`
- Create: `src/app/leads/[id]/lead-actions.tsx`

- [ ] **Step 1: Create directories**

```bash
mkdir -p "src/app/leads/[id]"
```

- [ ] **Step 2: Create the lead detail Server Component**

Create `src/app/leads/[id]/page.tsx`:

```typescript
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { Lead, Score } from '@/types/lead'
import Link from 'next/link'
import { LeadActions } from './lead-actions'

const SCORE_BADGE: Record<Score, string> = {
  hot: 'bg-green-100 text-green-800',
  warm: 'bg-yellow-100 text-yellow-800',
  cold: 'bg-red-100 text-red-800',
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const { id } = await params

  const { data } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('id', id)
    .eq('user_id', session!.user.id)
    .single()

  if (!data) notFound()

  const lead = data as Lead

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Link
        href="/dashboard"
        className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-block"
      >
        ← Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900">{lead.name}</h1>
          <p className="text-slate-500">{lead.address}</p>
        </div>
        {lead.score && (
          <span
            className={`mt-1 text-sm px-3 py-1 rounded-full font-medium shrink-0 ${
              SCORE_BADGE[lead.score]
            }`}
          >
            {lead.score}
          </span>
        )}
      </div>

      {/* Contact info */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Contact
        </h2>
        <div className="flex flex-col gap-2">
          {lead.phone ? (
            <a
              href={`tel:${lead.phone}`}
              className="text-sm text-indigo-600 hover:underline"
            >
              📞 {lead.phone}
            </a>
          ) : (
            <span className="text-sm text-slate-400">No phone listed</span>
          )}
          {lead.website ? (
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-600 hover:underline break-all"
            >
              🌐 {lead.website}
            </a>
          ) : (
            <span className="text-sm text-slate-400">No website</span>
          )}
          {lead.maps_url && (
            <a
              href={lead.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              📍 View on Google Maps
            </a>
          )}
        </div>
      </div>

      {/* AI Analysis */}
      {lead.score && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            AI Analysis
          </h2>
          {lead.score_label && (
            <div className="text-sm font-medium text-slate-700 mb-2">
              {lead.score_label}
            </div>
          )}
          {lead.reasoning && (
            <p className="text-sm text-slate-600 mb-3">{lead.reasoning}</p>
          )}
          {lead.pitch && (
            <div className="bg-slate-50 rounded-md px-4 py-3">
              <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">
                Suggested pitch
              </div>
              <p className="text-sm text-slate-700 italic">
                &ldquo;{lead.pitch}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pipeline actions */}
      <LeadActions
        leadId={lead.id}
        status={lead.status}
        notes={lead.notes ?? ''}
      />
    </div>
  )
}
```

- [ ] **Step 3: Create the LeadActions client component**

Create `src/app/leads/[id]/lead-actions.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { LeadStatus } from '@/types/lead'

export function LeadActions({
  leadId,
  status: initialStatus,
  notes: initialNotes,
}: {
  leadId: string
  status: LeadStatus
  notes: string
}) {
  const [status, setStatus] = useState<LeadStatus>(initialStatus)
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)

  async function updateLead(update: { status?: LeadStatus; notes?: string }) {
    setSaving(true)
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    setSaving(false)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        Pipeline
        {saving && <span className="text-xs font-normal text-slate-400">Saving…</span>}
      </h2>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm text-slate-600 block mb-1">Status</label>
          <select
            value={status}
            onChange={async (e) => {
              const newStatus = e.target.value as LeadStatus
              setStatus(newStatus)
              await updateLead({ status: newStatus })
            }}
            className="border border-slate-200 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="converted">Converted</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-600 block mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => updateLead({ notes })}
            placeholder="Add notes about this lead…"
            rows={4}
            className="border border-slate-200 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/leads"
git commit -m "feat: add lead detail page with AI analysis, status, and notes"
```

---

## Task 11: End-to-end smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test the Nav**

Go to http://localhost:3000/dashboard — you should see the dark nav bar with Dashboard, Search button, and Sign out.

- [ ] **Step 3: Test search**

Click Search → enter a business type (e.g. `plumbers`) and location (e.g. `Tampa, FL`) → click Search.
Expected: Up to 20 result cards appear with name, address, phone, website status.

- [ ] **Step 4: Test scoring**

Click "✦ Score" on a result without a website.
Expected: After ~2s, a hot/warm/cold badge appears with reasoning and pitch text.

- [ ] **Step 5: Test save**

Click "+ Save" on a result.
Expected: Button changes to "Saved ✓". Go to Dashboard — the lead appears in the list.

- [ ] **Step 6: Test lead detail**

Click the lead row on the Dashboard.
Expected: Lead detail page shows contact info, AI analysis (if scored), status dropdown, notes textarea.

- [ ] **Step 7: Test status update**

Change the status dropdown to "Contacted".
Expected: "Saving…" flashes briefly. Refresh the page — status is still "Contacted".

- [ ] **Step 8: Test dashboard filter**

Click the "Hot" stat card or "hot" filter pill.
Expected: URL changes to `/dashboard?filter=hot`, list filters accordingly.

- [ ] **Step 9: Test already-saved detection**

Go back to Search, run the same search again.
Expected: The lead you saved shows "Saved ✓" immediately — no Save button.

- [ ] **Step 10: Final commit**

```bash
git add .
git commit -m "chore: Phase 2 complete — search, scoring, and lead management verified"
```
