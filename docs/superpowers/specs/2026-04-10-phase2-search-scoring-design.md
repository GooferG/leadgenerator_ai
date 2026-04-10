# Lead Generator Phase 2: Search & AI Scoring — Design Spec

**Goal:** Let approved users search for local businesses via Google Places, score promising leads on-demand with Claude AI, save them to their pipeline, and manage them from a dashboard.

**Date:** 2026-04-10

---

## Pages & Navigation

Top nav: **Dashboard** · **Search** · **Admin** (admin only)

| Route | Component type | Purpose |
|---|---|---|
| `/dashboard` | Server Component | Stat cards + saved leads list with filter |
| `/search` | Client Component | Search form + Places results + Score/Save per result |
| `/leads/[id]` | Server Component + Client islands | Full lead detail, status/notes editing |
| `/admin` | Server Component | Phase 1 placeholder |

**Nav emphasis:** Search link gets a distinct button-style treatment — it's the primary action.

---

## Architecture & Data Flow

```
Browser
  ├── Server Components → Supabase (direct, server-side)
  └── Client Components → /api/* routes → Google Places API
                                        → Anthropic Claude API
                                        → Supabase (via supabaseAdmin)
```

**Why this separation:**
- API keys (Google, Anthropic) never reach the browser
- Dashboard/Lead detail fetch Supabase directly as Server Components (no API hop needed)
- Search and scoring require user interaction, so they run as Client Components hitting API routes

---

## API Routes

### `POST /api/search`

**Input:**
```json
{ "businessType": "restaurants", "location": "Tampa, FL", "radius": 8047 }
```
Radius is in metres (5 miles = 8047m).

**Logic:**
1. Validate session — return 401 if not authenticated or not approved
2. Call Google Places Text Search (`POST https://places.googleapis.com/v1/places:searchText`)
   - Query: `"{businessType} in {location}"`
   - FieldMask: `places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.id`
   - LocationRestriction: circle with radius
3. Map response to our shape and return

**Output:**
```json
[
  {
    "placeId": "ChIJ...",
    "name": "Mario's Pizza",
    "address": "123 Main St, Tampa, FL",
    "phone": "(813) 555-0101",
    "website": null,
    "rating": 4.2,
    "reviewCount": 87,
    "mapsUrl": "https://maps.google.com/..."
  }
]
```

---

### `POST /api/score`

**Input:**
```json
{
  "placeId": "ChIJ...",
  "name": "Mario's Pizza",
  "address": "123 Main St, Tampa, FL",
  "businessType": "restaurant",
  "phone": "(813) 555-0101",
  "website": null,
  "rating": 4.2,
  "reviewCount": 87
}
```

**Logic:**
1. Validate session — return 401 if unauthenticated/unapproved
2. Build Claude prompt (see below)
3. Call `claude-haiku-4-5` with `max_tokens: 300`
4. Parse JSON from response, return to client

**Claude prompt:**
```
You help freelance web developers identify local businesses that need a new website.
Analyze this business and score the lead opportunity.

Business: {{name}}
Type: {{businessType}}
Location: {{address}}
Website: {{website ?? "none"}}
Phone: {{phone ?? "none"}}
Google rating: {{rating}} ({{reviewCount}} reviews)

Scoring criteria:
- hot: no website at all, or clearly broken/placeholder site
- warm: has a website but it looks outdated, low-quality, or not mobile-friendly
- cold: has a modern, functional website — unlikely to need help

Respond ONLY with valid JSON, no markdown:
{
  "score": "hot" | "warm" | "cold",
  "scoreLabel": "<4-6 word label, e.g. 'No website found'>",
  "reasoning": "<1-2 sentences explaining the score>",
  "pitch": "<1-2 sentence cold outreach opener the developer could use>"
}
```

**Output:**
```json
{
  "score": "hot",
  "scoreLabel": "No website found",
  "reasoning": "Mario's Pizza has no website despite 87 reviews. High foot traffic suggests an established business that could benefit significantly from an online presence.",
  "pitch": "Hi Mario's team — I noticed you don't have a website yet, even though you have great reviews on Google. I build affordable websites for restaurants in Tampa and would love to help."
}
```

---

### `POST /api/leads`

**Input:** Full lead object (business data + score data if scored, otherwise score fields are null)

**Logic:**
1. Validate session
2. Insert into Supabase `leads` table with `user_id` from session
3. Return `{ id }` of new row

---

### `PATCH /api/leads/[id]`

**Input:** `{ status?, notes? }` — either or both

**Logic:**
1. Validate session
2. Verify `leads.user_id = session.user.id` — reject if not owner (prevents users editing each other's leads)
3. Update row, return updated lead

---

## Dashboard Page (`/dashboard`)

Server Component — fetches directly from Supabase using `searchParams`.

**How filtering works:** Filter state lives in the URL (`/dashboard?filter=hot`). Stat cards and filter buttons are Client Components that push to the URL with `router.push()`. The Server Component reads `searchParams.filter` and queries Supabase with the appropriate `WHERE` clause. This means the filtered view is bookmarkable and shareable.

**Stat cards (clickable):**
- Total leads
- Hot leads → clicking sets `?filter=hot`
- Contacted → clicking sets `?filter=contacted`

**Leads list:**
- Filter bar: All · Hot · Warm · Cold · Contacted · Converted
- Each row: business name, address, score badge, status badge, phone, created date
- Clicking a row → `/leads/[id]`
- Empty state: "No leads yet — go search for some" with link to /search

---

## Search Page (`/search`)

Client Component (needs interactivity).

**Form fields:**
- Business type (text input, e.g. "restaurants", "plumbers")
- Location (text input, e.g. "Tampa, FL")
- Radius (select: 1 mi / 5 mi / 10 mi / 25 mi)
- Search button

**Result cards** (after search):
- Name, address, phone, website (or "No website" badge), rating
- Google Maps link
- "Score" button → calls `/api/score`, shows spinner, replaces button with score badge + reasoning + pitch
- "Save" button → calls `/api/leads`, shows checkmark on success. Disabled if already saved.

**"Already saved" tracking:** On page load, fetch the current user's saved `placeId`s from `/api/leads?fields=placeId` and store in a React `Set`. After a successful save, add the placeId to the set. Any result card whose placeId is in the set shows "Saved ✓" instead of a Save button.

**States to handle:**
- Loading (searching): skeleton cards
- Empty results: "No results found for that search"
- Score loading: spinner on that card only
- Already saved: "Saved ✓" label on button

---

## Lead Detail Page (`/leads/[id]`)

Server Component for initial data load. Client islands for editable fields.

**Sections:**
1. **Header:** Business name, address, score badge
2. **Contact info:** Phone (with tel: link), Website (with external link), Google Maps link
3. **AI Analysis** (if scored): Score label, reasoning paragraph, pitch text (copyable)
4. **Pipeline status:** Status dropdown (new / contacted / converted) — updates via `PATCH /api/leads/[id]`
5. **Notes:** Textarea — auto-saves on blur via `PATCH /api/leads/[id]`
6. **Back link:** ← Back to Dashboard

---

## Dependencies to Add

```bash
npm install @anthropic-ai/sdk
```

`GOOGLE_PLACES_API_KEY` is already in `.env.local.example`. `ANTHROPIC_API_KEY` needs to be added to `.env.local` and `.env.local.example`.

---

## Google Places API Notes

- API: Places API (New) — `places.googleapis.com/v1`
- Auth: `X-Goog-Api-Key` header (server-side only, never browser)
- Cost: Text Search is charged per field group requested. Using only Basic + Contact fields keeps it at the cheapest tier (~$0.017 per search call for up to 20 results)
- The `website` field being `null` or absent is the primary hot-lead signal

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Google Places returns 0 results | Show empty state message |
| Google Places API error | Show "Search failed, try again" toast |
| Claude returns malformed JSON | Show "Scoring failed" on that card, allow retry |
| Save fails (duplicate) | Show "Already in your leads" message |
| User not approved | Middleware already blocks — won't reach these pages |

---

## What's NOT in Phase 2

- Email scraping from business websites
- Bulk scoring (score all results at once)
- Lead export (CSV)
- Admin user approval UI (Phase 1 placeholder remains)
- Pagination on search results (capped at 20 from Places API)
