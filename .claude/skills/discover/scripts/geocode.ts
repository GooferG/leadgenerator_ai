// Geocode an address/area string to lat/lng via the Google Geocoding API.
// Standalone-runnable for debugging:
//   npx tsx .claude/skills/discover/scripts/geocode.ts "West Austin, TX"

import type { GeocodeResult } from './types'

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

export async function geocode(area: string): Promise<GeocodeResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not set')

  const url = `${GEOCODE_URL}?address=${encodeURIComponent(area)}&key=${apiKey}`
  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`Geocoding HTTP ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()

  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(`Geocoding failed for "${area}": ${data.status} ${data.error_message ?? ''}`)
  }

  const top = data.results[0]
  return {
    area_label: area,
    lat: top.geometry.location.lat,
    lng: top.geometry.location.lng,
  }
}

// Standalone CLI entry
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const area = process.argv.slice(2).join(' ').trim()
  if (!area) {
    console.error('Usage: tsx geocode.ts "<area string>"')
    process.exit(1)
  }
  geocode(area)
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => {
      console.error(e.message)
      process.exit(1)
    })
}
