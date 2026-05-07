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

// Shape Claude returns. Either chain-flagged (skip the rest) or fully enriched.
export interface ClaudeEnrichment {
  is_chain: boolean
  chain_flag_reason: string | null
  diagnosis: string
  site_brief: SiteBrief
  cold_message: string
}

export interface EnrichmentResult {
  lead_id: string
  outcome: 'enriched' | 'archived_chain' | 'failed'
  reason?: string
}
