// Pure filter helpers shared between the discover skill and the UI search route.
// Keep colocation-free: no fetch calls, no env access, no IO. Just data in,
// data out. The skill duplicates the Places client deliberately (so it can
// run standalone via tsx) but the filter math is identical and worth sharing.

import type { PlaceResult } from '@/types/lead'

export interface DiscoverFilters {
  max_reviews?: number
  min_rating?: number
  has_website?: 'any' | 'none' | 'present'
  skip_top_n?: number
}

export const DISCOVER_DEFAULTS = {
  max_reviews: 50,
  min_rating: 4.0,
  has_website: 'any' as const,
  skip_top_n: 3,
}

export const NICHE_PRESETS = [
  'roofer',
  'landscaper',
  'plumber',
  'fence-installer',
  'chimney-repair',
  'hvac',
  'dental-practice',
  'cosmetic-dentist',
  'salon',
  'law-firm',
  'real-estate-agent',
  'photographer',
  'event-venue',
] as const

// Drop the top N — heuristic: dominant local players don't need a new site.
export function skipTopN(leads: PlaceResult[], n: number): PlaceResult[] {
  if (n <= 0) return leads
  return leads.slice(n)
}

// Apply rating / review-count / website-presence filters.
export function applyFilters(
  leads: PlaceResult[],
  filters?: DiscoverFilters
): PlaceResult[] {
  const f = { ...DISCOVER_DEFAULTS, ...(filters ?? {}) }

  return leads.filter((l) => {
    if (l.rating !== null && l.rating < f.min_rating) return false
    if (l.reviewCount !== null && l.reviewCount > f.max_reviews) return false
    if (f.has_website === 'none' && l.website) return false
    if (f.has_website === 'present' && !l.website) return false
    return true
  })
}

// Global dedupe by placeId across multiple area batches.
export function dedupeByPlaceId(leads: PlaceResult[]): PlaceResult[] {
  const seen = new Set<string>()
  const out: PlaceResult[] = []
  for (const l of leads) {
    if (seen.has(l.placeId)) continue
    seen.add(l.placeId)
    out.push(l)
  }
  return out
}
