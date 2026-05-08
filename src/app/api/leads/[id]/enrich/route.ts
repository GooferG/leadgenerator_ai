import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { anthropic } from '@/lib/anthropic'

// Trigger the combined enrichment pass for a single lead from the dashboard.
// Mirrors what the enrich skill does, but session-auth only and one lead at
// a time. Used by the lead detail page's "Re-enrich" button.
//
// Process:
//   1. Fetch the lead
//   2. Scrape its website (best-effort)
//   3. Call Claude with the combined prompt
//   4. Insert enrichment row + mirror CRM fields to leads + bump status
//
// Returns the new enrichment id and the parsed Claude output so the UI can
// refresh without an extra GET.

const MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `You are a senior local marketing strategist who builds websites and outreach for small local-service businesses (roofers, dentists, plumbers, salons, etc.). You produce concise, practical, no-fluff output.

Hard rules — apply to ALL output:
- No buzzwords ("synergy", "leverage", "unlock", "best-in-class", "cutting-edge", "elevate", etc.)
- No corporate language ("solutions", "ecosystem", "stakeholder", "scale")
- No mention of AI, automation, or that this was generated
- No emoji
- No exclamation points

Your job: given a local business's public details (and optionally their current website content), return a JSON object with a CRM-facing assessment AND a marketing/website plan.

If the business is a national chain, franchise location, or any operation where the local manager is unlikely to be the decision maker for marketing/website work, set is_chain=true with a reason and skip the rest (still return all fields but use short placeholders).

When site content IS provided, lean on it heavily:
- site_audit should reference concrete issues you can see ("phone number not above the fold", "no service-area mentioned", "broken meta description", etc.)
- diagnosis should contrast their current site with what's possible
- site_brief should be designed as a clear improvement, not a generic template

When site content is NOT provided (no website / scrape failed), say so honestly:
- site_audit: ["no website to audit"]
- diagnosis: focus on the absence of an online presence, not site-specific issues`

interface ParsedEnrichment {
  is_chain: boolean
  chain_flag_reason: string | null
  score: 'hot' | 'warm' | 'cold'
  score_label: string
  reasoning: string
  pitch: string
  site_audit: string[]
  diagnosis: string
  site_brief: {
    hero_angle: string
    services: string[]
    tone: string
    palette: string
    cta_copy: string
    design_choice: string
  }
  cold_message: string
}

async function scrapeUrl(url: string): Promise<{ bodyText: string; title: string | null; description: string | null; error: string | null }> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadScout/1.0)' },
    })
    if (!res.ok) return { bodyText: '', title: null, description: null, error: 'blocked' }
    const html = await res.text()
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const bodyRaw = bodyMatch?.[1] ?? html
    const bodyText = bodyRaw
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1500)
    return {
      bodyText,
      title: titleMatch?.[1]?.trim() ?? null,
      description: descMatch?.[1] ?? null,
      error: null,
    }
  } catch (err) {
    const e = err as Error
    return {
      bodyText: '',
      title: null,
      description: null,
      error: e.name === 'AbortError' ? 'timeout' : 'unreachable',
    }
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.approved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Shared workspace: any approved user can enrich any lead. Matches the
  // bulk-save and discover skill paths, which already operate on the shared
  // pool. Phase 4 dashboard redesign will surface ownership where useful.
  //
  // NOTE: leads table doesn't have a `rating` column — Places rating arrives
  // inside `place_data` jsonb. We pull it from there if present.
  const { data: lead, error: leadError } = await supabaseAdmin
    .from('leads')
    .select('id, business_name, name, business_address, address, business_phone, phone, website, niche, area_label, place_data')
    .eq('id', id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const placeData = (lead.place_data ?? {}) as Record<string, unknown>
  const rating = (placeData.rating as number | undefined) ?? null

  // Scrape (best-effort)
  let scrapeError: string | null = null
  let siteSection: string

  if (lead.website) {
    const scraped = await scrapeUrl(lead.website)
    if (scraped.error) {
      scrapeError = scraped.error
      siteSection = `Current website: ${lead.website} (could not be scraped — ${scraped.error})`
    } else {
      siteSection = `Current website content:
- URL: ${lead.website}
- Title: ${scraped.title ?? 'none'}
- Meta description: ${scraped.description ?? 'none'}
- Body text (truncated):
"""
${scraped.bodyText}
"""`
    }
  } else {
    siteSection = 'No website on file.'
  }

  const userPrompt = `Business details:
- Name: ${lead.business_name ?? lead.name}
- Address: ${lead.business_address ?? lead.address ?? 'unknown'}
- Phone: ${lead.business_phone ?? lead.phone ?? 'unknown'}
- Niche: ${lead.niche ?? 'unknown'}
- Area: ${lead.area_label ?? 'unknown'}
- Google rating: ${rating ?? 'unknown'}

${siteSection}

Return ONLY a single JSON object with this exact shape (no markdown, no commentary):

{
  "is_chain": boolean,
  "chain_flag_reason": string | null,
  "score": "hot" | "warm" | "cold",
  "score_label": string,
  "reasoning": string,
  "pitch": string,
  "site_audit": string[],
  "diagnosis": string,
  "site_brief": {
    "hero_angle": string,
    "services": string[],
    "tone": string,
    "palette": string,
    "cta_copy": string,
    "design_choice": string
  },
  "cold_message": string
}

Field rules: same conventions as the enrich skill. If is_chain=true, use literal "skipped — chain" placeholders for prose fields and ["chain location, not a good fit"] for site_audit.`

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const block = message.content[0]
  if (!block || block.type !== 'text') {
    return NextResponse.json({ error: 'Claude returned no text' }, { status: 502 })
  }

  const cleaned = block.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  let parsed: ParsedEnrichment
  try {
    parsed = JSON.parse(cleaned) as ParsedEnrichment
  } catch (err) {
    console.error('Could not parse Claude JSON:', err, cleaned.slice(0, 500))
    return NextResponse.json({ error: 'Claude output not parseable' }, { status: 502 })
  }

  // Persist enrichment
  const { data: enrichment, error: insertError } = await supabaseAdmin
    .from('enrichments')
    .insert({
      lead_id: lead.id,
      diagnosis: parsed.diagnosis,
      site_brief: parsed.site_brief,
      cold_message: parsed.cold_message,
      chain_flag_reason: parsed.is_chain ? parsed.chain_flag_reason : null,
      model_version: MODEL,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('Enrichment insert error:', insertError)
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
  }

  // Mirror to leads + bump status
  const isChain = parsed.is_chain
  const leadUpdate: Record<string, unknown> = isChain
    ? { status: 'archived', is_chain: true }
    : { status: 'enriched' }
  leadUpdate.score = parsed.score
  leadUpdate.score_label = parsed.score_label
  leadUpdate.reasoning = parsed.reasoning
  leadUpdate.pitch = parsed.pitch
  leadUpdate.site_audit = parsed.site_audit
  leadUpdate.scrape_error = !!scrapeError

  await supabaseAdmin
    .from('leads')
    .update(leadUpdate)
    .eq('id', lead.id)

  return NextResponse.json({ id: enrichment.id, enrichment: parsed }, { status: 201 })
}
