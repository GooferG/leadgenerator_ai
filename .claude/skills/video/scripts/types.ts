// Shared types for the video skill scripts. Standalone — no imports from src.

export interface MockupReadyLead {
  id: string
  business_name: string | null
  name: string | null
  niche: string | null
  area_label: string | null
  mockups?: Array<{
    id: string
    slug: string
    published_at: string | null
  }> | null
}

export interface VideoResult {
  lead_id: string
  outcome: 'created' | 'failed' | 'skipped'
  reason?: string
  public_url?: string
}
