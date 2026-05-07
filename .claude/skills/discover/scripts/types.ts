// Shared types for the discover skill scripts.
// Kept colocated rather than imported from src/types so the scripts can run
// standalone via tsx without dragging in the Next.js app.

export interface DiscoverFilters {
  max_reviews?: number
  min_rating?: number
  has_website?: 'any' | 'none' | 'present'
  skip_top_n?: number
}

export interface DiscoverInput {
  niche: string
  city: string
  areas?: string[]
  filters?: DiscoverFilters
  // radius in meters; defaults applied downstream
  per_area_radius_m?: number
  target_per_area?: number
}

export interface GeocodeResult {
  area_label: string
  lat: number
  lng: number
}

// One Place Details record. Mirrors the shape /api/leads/bulk expects in `LeadInputSchema`.
export interface PlaceLead {
  place_id: string
  business_name: string
  business_address: string | null
  business_phone: string | null
  website_url: string | null
  rating: number | null
  review_count: number | null
  maps_url: string | null
  // Echoed onto each lead by the orchestrator before pushing to Hook
  niche?: string
  area_label?: string
  area_lat?: number
  area_lng?: number
  // Full Places payload for later use (kept opaque)
  place_data?: unknown
}

export interface BulkResponse {
  inserted: number
  skipped: number
  lead_ids: string[]
}
