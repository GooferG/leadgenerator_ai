import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { SiteContent } from '@/types/lead'

type ScrapeError = 'timeout' | 'blocked' | 'unreachable'

function extractMeta(html: string, name: string): string | null {
  const m =
    html.match(
      new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')
    ) ??
    html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i')
    )
  return m?.[1] ?? null
}

function extractOgTag(html: string, property: string): string | null {
  const m =
    html.match(
      new RegExp(`<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`, 'i')
    ) ??
    html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${property}["']`, 'i')
    )
  return m?.[1] ?? null
}

function parseHtml(html: string): SiteContent {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const title = titleMatch?.[1]?.trim() ?? null

  const description = extractMeta(html, 'description')
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html)

  const ogTags: Record<string, string> = {}
  const ogTitle = extractOgTag(html, 'title')
  const ogDesc = extractOgTag(html, 'description')
  if (ogTitle) ogTags['og:title'] = ogTitle
  if (ogDesc) ogTags['og:description'] = ogDesc

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const bodyRaw = bodyMatch?.[1] ?? html
  const bodyText = bodyRaw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000)

  return { title, description, hasViewport, ogTags, bodyText }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.approved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { url } = await req.json()

  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadScout/1.0)' },
    })

    if (!res.ok) {
      const scrapeError: ScrapeError = 'blocked'
      return NextResponse.json({ error: scrapeError })
    }

    const html = await res.text()
    const content = parseHtml(html)
    return NextResponse.json({ content })
  } catch (err: unknown) {
    let scrapeError: ScrapeError = 'unreachable'
    if (err instanceof Error && err.name === 'AbortError') {
      scrapeError = 'timeout'
    }
    return NextResponse.json({ error: scrapeError })
  }
}
