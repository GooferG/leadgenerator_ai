// Shared types for the mockup skill scripts. Standalone to keep the scripts
// runnable via tsx without dragging in the Next.js app.

export interface EnrichedLead {
  id: string
  business_name: string | null
  name: string | null
  business_address: string | null
  address: string | null
  business_phone: string | null
  phone: string | null
  niche: string | null
  area_label: string | null
  enrichments?: Array<{
    site_brief: {
      hero_angle?: string
      services?: string[]
      tone?: string
      palette?: string
      cta_copy?: string
      design_choice?: string
    } | null
  }> | null
}

export interface MockupResult {
  lead_id: string
  outcome: 'created' | 'failed' | 'skipped'
  reason?: string
  slug?: string
  public_url?: string
}
