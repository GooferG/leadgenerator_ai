// Call Hook's /api/scrape endpoint to fetch the lead's website content.
// We delegate to the existing route rather than duplicating scraping logic
// here — the API already handles timeouts, blocked sites, and HTML parsing.

import type { ScrapedSite } from './types'

interface ScrapeOpts {
  url: string
  baseUrl?: string
}

interface ScrapeResponse {
  content?: ScrapedSite
  error?: 'timeout' | 'blocked' | 'unreachable'
}

export async function scrapeSite(opts: ScrapeOpts): Promise<{
  content: ScrapedSite | null
  error: string | null
}> {
  const apiBase = opts.baseUrl ?? process.env.HOOK_API_BASE_URL ?? 'http://localhost:3000'
  const serviceKey = process.env.HOOK_SERVICE_API_KEY
  if (!serviceKey) throw new Error('HOOK_SERVICE_API_KEY not set')

  const res = await fetch(`${apiBase}/api/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hook-service-key': serviceKey,
    },
    body: JSON.stringify({ url: opts.url }),
  })

  // Network/auth-level failure — bubble up
  if (!res.ok) {
    return { content: null, error: `scrape api ${res.status}` }
  }

  const data = (await res.json()) as ScrapeResponse
  if (data.error) {
    return { content: null, error: data.error }
  }
  if (!data.content) {
    return { content: null, error: 'empty response' }
  }
  return { content: data.content, error: null }
}
