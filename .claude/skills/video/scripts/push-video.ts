// POST video metadata to /api/videos. The file is already in Supabase Storage
// at this point — we just persist the row and bump lead.status.

interface PushOpts {
  lead_id: string
  mockup_id?: string | null
  storage_path: string
  public_url: string
  duration_seconds: number
  baseUrl?: string
}

interface VideoResponse {
  id: string
  warning?: string
}

export async function pushVideo(opts: PushOpts): Promise<VideoResponse> {
  const apiBase = opts.baseUrl ?? process.env.HOOK_API_BASE_URL ?? 'http://localhost:3000'
  const serviceKey = process.env.HOOK_SERVICE_API_KEY
  if (!serviceKey) throw new Error('HOOK_SERVICE_API_KEY not set')

  const payload = {
    lead_id: opts.lead_id,
    mockup_id: opts.mockup_id ?? undefined,
    storage_path: opts.storage_path,
    public_url: opts.public_url,
    duration_seconds: opts.duration_seconds,
  }

  const res = await fetch(`${apiBase}/api/videos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hook-service-key': serviceKey,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Hook POST /api/videos ${res.status}: ${text}`)
  }

  return (await res.json()) as VideoResponse
}
