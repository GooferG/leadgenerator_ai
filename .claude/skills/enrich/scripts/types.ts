// Shared types for the enrich skill scripts.
// Mirrors the relevant subset of the Supabase `leads` row + the structured
// JSON Claude returns. Colocated rather than imported from src/types so the
// scripts run standalone via tsx.

export interface DiscoveredLead {
  id: string
  business_name: string | null
  // Legacy column kept around for backwards compatibility — when business_name is null we fall back here
  name: string | null
  business_address: string | null
  address: string | null
  business_phone: string | null
  phone: string | null
  website: string | null
  niche: string | null
  area_label: string | null
  rating: number | null
  // place_data is fetched-from-Google blob; opaque from the skill's POV
  place_data: unknown
  status: string
}

export interface SiteBrief {
  hero_angle: string
  services: string[]
  tone: string
  palette: string
  cta_copy: string
  design_choice: string
}

// Site content scraped from the lead's website (subset of /api/scrape output).
// Claude reads this when deciding what's wrong with the current site and what
// the mockup should fix.
export interface ScrapedSite {
  title: string | null
  description: string | null
  hasViewport: boolean
  ogTags: Record<string, string>
  bodyText: string
}

// Shape Claude returns. Either chain-flagged (skip the rest) or fully enriched.
// Phase 3.5: now also produces score + site_audit + pitch (operator-facing) so
// a single Claude call covers both the legacy CRM fields on `leads` AND the new
// `enrichments` row.
export interface ClaudeEnrichment {
  is_chain: boolean
  chain_flag_reason: string | null

  // CRM-facing (mirrored to leads table)
  score: 'hot' | 'warm' | 'cold'
  score_label: string  // e.g. "ready-to-buy", "needs nurturing"
  reasoning: string    // explains why hot/warm/cold
  pitch: string        // 1-2 line internal pitch summary for the operator
  site_audit: string[] // bullet list of concrete issues with the current site

  // Pipeline-facing (persisted to enrichments table)
  diagnosis: string
  site_brief: SiteBrief
  cold_message: string  // outbound; what gets sent to the lead
}

export interface EnrichmentResult {
  lead_id: string
  outcome: 'enriched' | 'archived_chain' | 'failed'
  reason?: string
}
