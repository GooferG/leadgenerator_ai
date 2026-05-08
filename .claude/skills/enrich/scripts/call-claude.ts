// Call Claude (Sonnet 4.6) with the combined enrichment prompt and parse the
// structured JSON. Phase 3.5: prompt now produces both CRM-facing fields
// (score, site_audit, pitch) and pipeline-facing fields (diagnosis,
// site_brief, cold_message) in one call.

import Anthropic from '@anthropic-ai/sdk'
import type { ClaudeEnrichment, DiscoveredLead, ScrapedSite } from './types'

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

const USER_PROMPT_TEMPLATE = (lead: DiscoveredLead, site: ScrapedSite | null, scrapeError: string | null) => {
  const siteSection = site
    ? `Current website content:
- URL: ${lead.website}
- Title: ${site.title ?? 'none'}
- Meta description: ${site.description ?? 'none'}
- Has mobile viewport meta: ${site.hasViewport}
- OG tags: ${Object.keys(site.ogTags).length ? JSON.stringify(site.ogTags) : 'none'}
- Body text (truncated):
"""
${site.bodyText.slice(0, 1500)}
"""`
    : lead.website
    ? `Current website: ${lead.website} (could not be scraped — ${scrapeError ?? 'unknown reason'})`
    : `No website on file.`

  return `Business details:
- Name: ${lead.business_name ?? lead.name}
- Address: ${lead.business_address ?? lead.address ?? 'unknown'}
- Phone: ${lead.business_phone ?? lead.phone ?? 'unknown'}
- Niche: ${lead.niche ?? 'unknown'}
- Area: ${lead.area_label ?? 'unknown'}
- Google rating: ${lead.rating ?? 'unknown'}

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

Field rules:
- score: "hot" = clear opportunity (weak online presence + good offline signals), "warm" = decent fit but more nurturing needed, "cold" = poor fit (saturated, unreachable, or wrong audience)
- score_label: 2-4 word internal label e.g. "Ready to pitch", "Needs nurturing", "Saturated market"
- reasoning: 1-3 sentences explaining the score. Specific to THIS business.
- pitch: 1-2 line internal summary for the operator's CRM — what's the angle for this lead?
- site_audit: 2-6 bullet items, each a concrete issue with the current site (or ["no website to audit"] if applicable). Specific, not generic.
- diagnosis: ~50 words. What's wrong with their current online presence and what opportunity that creates.
- site_brief: a concrete plan for the website you would build them. ~100 words total across the fields. services array should be 3-6 items. palette: 2-3 colors with a justification. design_choice is one sentence on the visual direction. Vary across leads — do not always default to the most obvious niche+region combo.
- cold_message: <70 words. Opens with ONE specific observation about THIS business — ideally something visible from their site or listing. Ends with a soft ask to see a free mockup. First-person, plain English. No subject line.

If is_chain is true: set chain_flag_reason to a brief explanation. Set score="cold", score_label="Chain — skip", and use literal strings "skipped — chain" for diagnosis, all site_brief fields, and cold_message. Set site_audit to ["chain location, not a good fit"].`
}

export async function enrichWithClaude(
  lead: DiscoveredLead,
  site: ScrapedSite | null,
  scrapeError: string | null
): Promise<{
  enrichment: ClaudeEnrichment
  modelVersion: string
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: USER_PROMPT_TEMPLATE(lead, site, scrapeError) }],
  })

  const block = message.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Claude response missing text block')
  }

  const raw = block.text.trim()
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()

  let parsed: ClaudeEnrichment
  try {
    parsed = JSON.parse(cleaned) as ClaudeEnrichment
  } catch (err) {
    throw new Error(`Could not parse Claude JSON: ${(err as Error).message}\n--- raw output ---\n${raw}`)
  }

  return { enrichment: parsed, modelVersion: MODEL }
}
