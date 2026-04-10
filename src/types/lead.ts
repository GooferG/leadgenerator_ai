export type Score = 'hot' | 'warm' | 'cold'
export type LeadStatus = 'new' | 'contacted' | 'converted'

// Shape returned by GET /api/search (mapped from Google Places)
export interface PlaceResult {
  placeId: string
  name: string
  address: string
  phone: string | null
  website: string | null
  rating: number | null
  reviewCount: number | null
  mapsUrl: string
}

// Shape returned by POST /api/score (from Claude)
export interface ScoreResult {
  score: Score
  scoreLabel: string
  reasoning: string
  pitch: string
}

// Shape of a row in the Supabase leads table
export interface Lead {
  id: string
  user_id: string
  place_id: string | null
  name: string
  address: string | null
  phone: string | null
  website: string | null
  score: Score | null
  score_label: string | null
  reasoning: string | null
  pitch: string | null
  status: LeadStatus
  notes: string | null
  maps_url: string | null
  created_at: string
}
