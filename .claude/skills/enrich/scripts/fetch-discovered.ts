// Fetch leads with status='discovered' from Hook for the enrichment skill.
// Uses the service-key auth path so the skill can run from outside a browser.

import type { DiscoveredLead } from './types'

interface FetchOpts {
  batch_size: number
  niche?: string
  area_label?: string
  baseUrl?: string
}

export async function fetchDiscoveredLeads(opts: FetchOpts): Promise<DiscoveredLead[]> {
  const apiBase = opts.baseUrl ?? process.env.HOOK_API_BASE_URL ?? 'http://localhost:3000'
  const serviceKey = process.env.HOOK_SERVICE_API_KEY
  if (!serviceKey) throw new Error('HOOK_SERVICE_API_KEY not set')

  const params = new URLSearchParams({
    status: 'discovered',
    scope: 'all',
    limit: String(opts.batch_size),
  })
  if (opts.niche) params.set('niche', opts.niche)
  if (opts.area_label) params.set('area_label', opts.area_label)

  const res = await fetch(`${apiBase}/api/leads?${params.toString()}`, {
    headers: { 'x-hook-service-key': serviceKey },
  })

  if (!res.ok) {
    throw new Error(`Hook GET /api/leads ${res.status}: ${await res.text()}`)
  }

  return (await res.json()) as DiscoveredLead[]
}
