// POST a lead_id to /api/mockups. The API derives props from the lead's latest
// enrichment and returns the public URL. We don't need to send props from the
// skill — keep the contract small and let the API be the single source of
// truth for prop derivation.

interface PushOpts {
  lead_id: string
  baseUrl?: string
}

interface MockupResponse {
  id: string
  slug: string
  public_url: string
}

export async function pushMockup({ lead_id, baseUrl }: PushOpts): Promise<MockupResponse> {
  const apiBase = baseUrl ?? process.env.HOOK_API_BASE_URL ?? 'http://localhost:3000'
  const serviceKey = process.env.HOOK_SERVICE_API_KEY
  if (!serviceKey) throw new Error('HOOK_SERVICE_API_KEY not set')

  const res = await fetch(`${apiBase}/api/mockups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hook-service-key': serviceKey,
    },
    body: JSON.stringify({ lead_id }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Hook POST /api/mockups ${res.status}: ${text}`)
  }

  return (await res.json()) as MockupResponse
}
