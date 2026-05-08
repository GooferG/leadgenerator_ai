import { PlaceResult } from '@/types/lead'

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText'
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

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
  'nextPageToken',
].join(',')

// Simple text search — used by the legacy single-business browse flow.
export async function searchPlaces(
  businessType: string,
  location: string,
  pageToken?: string
): Promise<{ results: PlaceResult[]; nextPageToken: string | null }> {
  const body: Record<string, unknown> = {
    textQuery: `${businessType} in ${location}`,
    maxResultCount: 20,
    ...(pageToken ? { pageToken } : {}),
  }

  const res = await fetch(PLACES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`Places API error: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()

  const results = (data.places ?? []).map((p: any): PlaceResult => ({
    placeId: p.id,
    name: p.displayName?.text ?? 'Unknown',
    address: p.formattedAddress ?? '',
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? null,
    mapsUrl: p.googleMapsUri ?? '',
  }))

  return { results, nextPageToken: data.nextPageToken ?? null }
}

// Geocode an address string → lat/lng. Used by the discover-mode UI flow
// to anchor location-biased searches per area.
export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not set')

  const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) return null

  const data = await res.json()
  if (data.status !== 'OK' || !data.results?.length) return null

  const top = data.results[0]
  return { lat: top.geometry.location.lat, lng: top.geometry.location.lng }
}

// Places Text Search with location bias — narrower, niche+area-aware.
// Used by the discover-mode UI flow.
export async function searchPlacesNearby(opts: {
  niche: string
  lat: number
  lng: number
  radius_m: number
  pageToken?: string
}): Promise<{ results: PlaceResult[]; nextPageToken: string | null }> {
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
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`Places API error: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()

  const results = (data.places ?? []).map((p: any): PlaceResult => ({
    placeId: p.id,
    name: p.displayName?.text ?? 'Unknown',
    address: p.formattedAddress ?? '',
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? null,
    mapsUrl: p.googleMapsUri ?? '',
  }))

  return { results, nextPageToken: data.nextPageToken ?? null }
}
