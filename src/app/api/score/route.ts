import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { anthropic } from '@/lib/anthropic'
import { ScoreResult, SiteContent } from '@/types/lead'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.approved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { name, businessType, address, website, phone, rating, reviewCount, siteContent } =
    body as {
      name: string
      businessType: string
      address: string
      website: string | null
      phone: string | null
      rating: number | null
      reviewCount: number | null
      siteContent?: SiteContent
    }

  const hasSiteContent = !!siteContent

  const basePrompt = `You help freelance web developers identify local businesses that need a new website.
Analyze this business and score the lead opportunity.

Business: ${name}
Type: ${businessType}
Location: ${address}
Website: ${website ?? 'none'}
Phone: ${phone ?? 'none'}
Google rating: ${rating ?? 'unknown'}${reviewCount ? ` (${reviewCount} reviews)` : ''}

Scoring criteria:
- hot: no website at all, or clearly broken/placeholder site
- warm: has a website but it looks outdated, low-quality, or not mobile-friendly
- cold: has a modern, functional website — unlikely to need help`

  const siteSection = hasSiteContent
    ? `\n\nScraped site content:
Title: ${siteContent.title ?? 'none'}
Meta description: ${siteContent.description ?? 'none'}
Has viewport meta tag: ${siteContent.hasViewport}
OG title: ${siteContent.ogTags['og:title'] ?? 'none'}
OG description: ${siteContent.ogTags['og:description'] ?? 'none'}
Body text (truncated): ${siteContent.bodyText}`
    : ''

  const outputShape = hasSiteContent
    ? `{
  "score": "hot" | "warm" | "cold",
  "scoreLabel": "<4-6 word label>",
  "reasoning": "<1-2 sentences explaining the score based on the actual site content>",
  "pitch": "<A conversational opener paragraph referencing specific things found on their site. Mention concrete weaknesses. Then naturally work in that the developer has been doing freelance web work for a while — WordPress builds, migrations, and modern headless setups — and has a technical support background so they can handle post-launch issues too. Keep it human, not salesy.>",
  "pitchBullets": ["<Specific improvement 1>", "<Specific improvement 2>", "<Specific improvement 3>"],
  "siteAudit": ["<Specific finding 1>", "<Specific finding 2>", "<Specific finding 3 — up to 5>"]
}`
    : `{
  "score": "hot" | "warm" | "cold",
  "scoreLabel": "<4-6 word label, e.g. No website found>",
  "reasoning": "<1-2 sentences explaining the score>",
  "pitch": "<A 2-3 sentence cold outreach opener tailored to this specific business. Open with something relevant to their situation (e.g. missing website, outdated design). Then naturally work in that the developer has been doing freelance web work for a while — WordPress builds, migrations, and modern headless setups — and has a technical support background so they can handle post-launch issues too. Keep it conversational and human, not salesy.>"
}`

  const prompt = `${basePrompt}${siteSection}

Respond ONLY with valid JSON, no markdown:
${outputShape}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text
    const text = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    const result: ScoreResult = JSON.parse(text)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Score error:', err)
    return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
  }
}
