// POST a batch of leads to Hook's /api/leads/bulk endpoint.
// Authenticated via x-hook-service-key header.

import type { BulkResponse, PlaceLead } from './types'

interface PushOpts {
  leads: PlaceLead[]
  baseUrl?: string
}

export async function pushToHook({ leads, baseUrl }: PushOpts): Promise<BulkResponse> {
  const apiBase = baseUrl ?? process.env.HOOK_API_BASE_URL ?? 'http://localhost:3000'
  const serviceKey = process.env.HOOK_SERVICE_API_KEY
  if (!serviceKey) throw new Error('HOOK_SERVICE_API_KEY not set')

  // Match LeadInputSchema in src/lib/schemas.ts exactly — the API rejects unknown fields softly
  // (zod ignores by default) but we minimize drift here to keep the contract clear.
  const payload = {
    leads: leads.map((l) => ({
      place_id: l.place_id,
      business_name: l.business_name,
      business_address: l.business_address,
      business_phone: l.business_phone,
      website_url: l.website_url,
      niche: l.niche!,
      area_label: l.area_label!,
      area_lat: l.area_lat ?? null,
      area_lng: l.area_lng ?? null,
      rating: l.rating,
      review_count: l.review_count,
      maps_url: l.maps_url,
      place_data: l.place_data,
    })),
  }

  const res = await fetch(`${apiBase}/api/leads/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hook-service-key': serviceKey,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Hook bulk insert ${res.status}: ${text}`)
  }

  return (await res.json()) as BulkResponse
}
