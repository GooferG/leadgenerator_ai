import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { geocode, searchPlaces, searchPlacesNearby } from '@/lib/places'
import {
  applyFilters,
  dedupeByPlaceId,
  skipTopN,
  type DiscoverFilters,
} from '@/lib/discover-filters'
import type { PlaceResult } from '@/types/lead'

// Two modes:
//
// LEGACY (backwards compatible): pass `businessType` + `location` (+ optional
// `pageToken`). Returns 20 raw Places results. Used by the existing single-
// business browse flow on /search.
//
// DISCOVER: pass `niche` + `city` (+ optional `areas[]`, `filters`). Geocodes
// each area, runs location-biased Places searches, dedupes globally, applies
// top-N skip + rating/review/website filters, and returns:
//   {
//     results,
//     stats: { discovered, after_top_skip, after_filters, areas: [...] },
//   }
//
// Discover mode does NOT insert. Caller decides whether to bulk-save the
// returned results via /api/leads/bulk.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.approved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))

  // Discover mode if niche is present
  if (body.niche && body.city) {
    return handleDiscover(body)
  }

  // Legacy mode
  const { businessType, location, pageToken } = body

  if (!businessType?.trim() || !location?.trim()) {
    return NextResponse.json(
      { error: 'businessType and location are required' },
      { status: 400 }
    )
  }

  try {
    const { results, nextPageToken } = await searchPlaces(
      businessType.trim(),
      location.trim(),
      pageToken ?? undefined
    )
    return NextResponse.json({ results, nextPageToken })
  } catch (err) {
    console.error('Places search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}

interface DiscoverBody {
  niche: string
  city: string
  areas?: string[]
  filters?: DiscoverFilters
}

async function handleDiscover(body: DiscoverBody) {
  const niche = body.niche.trim()
  const city = body.city.trim()
  const areas = (body.areas ?? []).map((a) => a.trim()).filter(Boolean)
  const filters = body.filters ?? {}

  if (!niche || !city) {
    return NextResponse.json(
      { error: 'niche and city are required' },
      { status: 400 }
    )
  }

  // If no areas specified, search city-wide with a wider radius.
  const areaQueries = areas.length ? areas.map((a) => `${a}, ${city}`) : [city]
  const radius = areas.length ? 5_000 : 15_000 // 5km neighborhood / 15km city-wide

  // 1. Geocode each area
  const points = await Promise.all(
    areaQueries.map(async (q) => ({ label: q, geo: await geocode(q) }))
  )
  const valid = points.filter((p): p is { label: string; geo: { lat: number; lng: number } } => !!p.geo)

  if (valid.length === 0) {
    return NextResponse.json(
      { error: `Could not geocode: ${areaQueries.join(', ')}` },
      { status: 400 }
    )
  }

  // 2. Search each area
  const perArea: PlaceResult[][] = []
  for (const point of valid) {
    try {
      const { results } = await searchPlacesNearby({
        niche,
        lat: point.geo.lat,
        lng: point.geo.lng,
        radius_m: radius,
      })
      // Annotate the area on each result so the UI can show provenance.
      // The PlaceResult type doesn't have area_* fields, but the client-side
      // ScoredResult interface does, so passing them through the JSON wire is
      // safe; we just cast back to PlaceResult[] for the perArea array typing.
      const annotated = results.map((r) => ({
        ...r,
        area_label: areas.length ? point.label.replace(`, ${city}`, '') : null,
        area_lat: point.geo.lat,
        area_lng: point.geo.lng,
      })) as unknown as PlaceResult[]
      perArea.push(annotated)
    } catch (err) {
      console.error(`Search failed for ${point.label}:`, err)
      perArea.push([])
    }
  }

  const discovered = perArea.reduce((sum, a) => sum + a.length, 0)

  // 3. Skip top N per area
  const skip = filters.skip_top_n ?? 3
  const trimmed = perArea.map((area) => skipTopN(area, skip))
  const afterTopSkip = trimmed.reduce((sum, a) => sum + a.length, 0)

  // 4. Combine + dedupe
  const combined = dedupeByPlaceId(trimmed.flat())

  // 5. Apply filters
  const filtered = applyFilters(combined, filters)

  return NextResponse.json({
    results: filtered,
    stats: {
      discovered,
      after_top_skip: afterTopSkip,
      after_dedupe: combined.length,
      after_filters: filtered.length,
      areas: valid.map((v) => ({
        label: v.label.replace(`, ${city}`, ''),
        lat: v.geo.lat,
        lng: v.geo.lng,
      })),
    },
  })
}
