// Places Text Search with location bias for the discover skill.
// Duplicates ~30 lines from src/lib/places.ts deliberately — the skill scripts
// must run standalone via tsx, so we don't import across the API/skill boundary.
//
// Standalone-runnable for debugging:
//   npx tsx .claude/skills/discover/scripts/places-search.ts \
//     --niche cosmetic-dentist --lat 30.30 --lng -97.78 --radius 5000

import type { PlaceLead } from './types'

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText'

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'nextPageToken',
].join(',')

interface SearchOpts {
  niche: string
  lat: number
  lng: number
  radius_m: number
  pageToken?: string
}

interface SearchResponse {
  results: PlaceLead[]
  nextPageToken: string | null
}

export async function searchPlacesNearby(opts: SearchOpts): Promise<SearchResponse> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not set')

  const body: Record<string, unknown> = {
    textQuery: opts.niche,
    maxResultCount: 20,
    locationBias: {
      circle: {
        center: { latitude: opts.lat, longitude: opts.lng },
        radius: opts.radius_m,
      },
    },
    ...(opts.pageToken ? { pageToken: opts.pageToken } : {}),
  }

  const res = await fetch(PLACES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  })

  if (res.status === 429 || res.status === 503) {
    // Quota / rate limit — bubble a typed error so the orchestrator can back off
    throw Object.assign(new Error(`Places API throttled: ${res.status}`), { code: 'THROTTLED' as const })
  }

  if (!res.ok) {
    throw new Error(`Places API ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()

  const results: PlaceLead[] = (data.places ?? []).map((p: Record<string, unknown>) => {
    const displayName = p.displayName as { text?: string } | undefined
    return {
      place_id: p.id as string,
      business_name: displayName?.text ?? 'Unknown',
      business_address: (p.formattedAddress as string) ?? null,
      business_phone: (p.nationalPhoneNumber as string) ?? null,
      website_url: (p.websiteUri as string) ?? null,
      rating: (p.rating as number) ?? null,
      review_count: (p.userRatingCount as number) ?? null,
      maps_url: (p.googleMapsUri as string) ?? null,
      place_data: p,
    }
  })

  return { results, nextPageToken: data.nextPageToken ?? null }
}

// Page through up to `target` results in a single area.
// Honors Google's ~2s requirement between page-token fetches.
export async function searchPlacesPaged(
  opts: SearchOpts & { target: number }
): Promise<PlaceLead[]> {
  const all: PlaceLead[] = []
  let pageToken: string | undefined

  while (all.length < opts.target) {
    const { results, nextPageToken } = await searchPlacesNearby({ ...opts, pageToken })
    all.push(...results)
    if (!nextPageToken || results.length === 0) break
    pageToken = nextPageToken
    await new Promise((r) => setTimeout(r, 2200)) // Google's recommended delay
  }

  return all.slice(0, opts.target)
}

// Standalone CLI entry
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const args = Object.fromEntries(
    process.argv.slice(2).reduce<string[][]>((acc, cur, i, arr) => {
      if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]])
      return acc
    }, [])
  )
  if (!args.niche || !args.lat || !args.lng) {
    console.error('Usage: tsx places-search.ts --niche <q> --lat <n> --lng <n> [--radius <m>] [--target <n>]')
    process.exit(1)
  }
  searchPlacesPaged({
    niche: args.niche,
    lat: parseFloat(args.lat),
    lng: parseFloat(args.lng),
    radius_m: parseInt(args.radius ?? '5000', 10),
    target: parseInt(args.target ?? '30', 10),
  })
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => {
      console.error(e.message)
      process.exit(1)
    })
}
