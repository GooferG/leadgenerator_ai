// POST a Claude enrichment to Hook's /api/enrichments endpoint.
// The API also bumps lead.status to 'enriched' (or 'archived' + is_chain=true if chain).

import type { ClaudeEnrichment } from './types'

interface PushOpts {
  lead_id: string
  enrichment: ClaudeEnrichment
  model_version: string
  baseUrl?: string
}

export async function pushEnrichment({
  lead_id,
  enrichment,
  model_version,
  baseUrl,
}: PushOpts): Promise<{ id: string; warning?: string }> {
  const apiBase = baseUrl ?? process.env.HOOK_API_BASE_URL ?? 'http://localhost:3000'
  const serviceKey = process.env.HOOK_SERVICE_API_KEY
  if (!serviceKey) throw new Error('HOOK_SERVICE_API_KEY not set')

  const payload = {
    lead_id,
    diagnosis: enrichment.diagnosis,
    site_brief: enrichment.site_brief,
    cold_message: enrichment.cold_message,
    chain_flag_reason: enrichment.is_chain ? enrichment.chain_flag_reason : null,
    model_version,
  }

  const res = await fetch(`${apiBase}/api/enrichments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hook-service-key': serviceKey,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Hook POST /api/enrichments ${res.status}: ${text}`)
  }

  return (await res.json()) as { id: string; warning?: string }
}
