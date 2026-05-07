// Call Claude (Sonnet 4.6) with the enrichment prompt and parse the structured JSON.
// Self-contained: imports the SDK directly and instantiates a new client per call —
// the skill runs standalone via tsx so we don't share the app's anthropic singleton.

import Anthropic from '@anthropic-ai/sdk'
import type { ClaudeEnrichment, DiscoveredLead } from './types'

const MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `You are a senior local marketing strategist who builds websites and outreach for small local-service businesses (roofers, dentists, plumbers, salons, etc.). You produce concise, practical, no-fluff output.

Hard rules — apply to ALL output:
- No buzzwords ("synergy", "leverage", "unlock", "best-in-class", "cutting-edge", "elevate", etc.)
- No corporate language ("solutions", "ecosystem", "stakeholder", "scale")
- No mention of AI, automation, or that this was generated
- No emoji
- No exclamation points

Your job: given a local business's public details, return a JSON object describing how you would approach them as a sales target for a small website + outreach service.

If the business is a national chain, franchise location, or any operation where the local manager is unlikely to be the decision maker for marketing/website work, set is_chain=true with a reason and skip the marketing analysis (still return the other fields but set them to short placeholder strings).`

const USER_PROMPT_TEMPLATE = (lead: DiscoveredLead) => `Business details:
- Name: ${lead.business_name ?? lead.name}
- Address: ${lead.business_address ?? lead.address ?? 'unknown'}
- Phone: ${lead.business_phone ?? lead.phone ?? 'unknown'}
- Website: ${lead.website ?? 'NONE'}
- Niche: ${lead.niche ?? 'unknown'}
- Area: ${lead.area_label ?? 'unknown'}
- Google rating: ${lead.rating ?? 'unknown'}

Return ONLY a single JSON object with this exact shape (no markdown, no commentary):

{
  "is_chain": boolean,
  "chain_flag_reason": string | null,
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
- diagnosis: ~50 words. What is wrong with their current online presence and what opportunity that creates. Specific to THIS business; no generic statements.
- site_brief: a concrete plan for the website you would build them. ~100 words total across the fields. services array should be 3-6 items. palette should be 2-3 colors with a justification. design_choice is one sentence on the visual direction (e.g. "warm neutral with serif headings, photography-led").
- cold_message: <70 words. Opens with ONE specific observation about THIS business (something a real human would notice from their address / website / reviews — not a template). Ends with a soft ask to see a free mockup. First-person, plain English. No subject line.

If is_chain is true: set chain_flag_reason to a brief explanation. Set diagnosis, site_brief fields, and cold_message to the literal string "skipped — chain".`

export async function enrichWithClaude(lead: DiscoveredLead): Promise<{
  enrichment: ClaudeEnrichment
  modelVersion: string
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: USER_PROMPT_TEMPLATE(lead) }],
  })

  const block = message.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Claude response missing text block')
  }

  const raw = block.text.trim()
  // Strip any leading/trailing fence in case the model ignores the "no markdown" rule.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()

  let parsed: ClaudeEnrichment
  try {
    parsed = JSON.parse(cleaned) as ClaudeEnrichment
  } catch (err) {
    throw new Error(`Could not parse Claude JSON: ${(err as Error).message}\n--- raw output ---\n${raw}`)
  }

  return { enrichment: parsed, modelVersion: MODEL }
}
