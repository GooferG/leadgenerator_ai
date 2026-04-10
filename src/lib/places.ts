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
