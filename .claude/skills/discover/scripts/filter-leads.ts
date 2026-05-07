// Filtering helpers for the discover skill.
// All filters are pure functions — easy to unit-test or run inline.

import type { DiscoverFilters, PlaceLead } from './types'

const DEFAULTS = {
  max_reviews: 50,
  min_rating: 4.0,
  has_website: 'any' as const,
  skip_top_n: 3,
}

// Drop the top N results — they're the dominant local players who don't need a new site.
// Operates per-area before global dedupe so each area contributes a fair share.
export function skipTopN(leads: PlaceLead[], n: number): PlaceLead[] {
  if (n <= 0) return leads
  return leads.slice(n)
}

// Apply rating / review-count / website-presence filters.
// `has_website`:
//   'any'     — pass everything
//   'none'    — keep only leads without a website (the "weak online presence" target)
//   'present' — keep only leads with a website (rare, mostly for testing)
export function applyFilters(leads: PlaceLead[], filters?: DiscoverFilters): PlaceLead[] {
  const f = { ...DEFAULTS, ...(filters ?? {}) }

  return leads.filter((l) => {
    if (l.rating !== null && l.rating < f.min_rating) return false
    if (l.review_count !== null && l.review_count > f.max_reviews) return false
    if (f.has_website === 'none' && l.website_url) return false
    if (f.has_website === 'present' && !l.website_url) return false
    return true
  })
}

// Debug variant — returns each lead with the reason it was rejected (or null if passed).
export function explainFilters(
  leads: PlaceLead[],
  filters?: DiscoverFilters
): Array<{ lead: PlaceLead; rejected: string | null }> {
  const f = { ...DEFAULTS, ...(filters ?? {}) }
  return leads.map((l) => {
    if (l.rating !== null && l.rating < f.min_rating) {
      return { lead: l, rejected: `rating ${l.rating} < ${f.min_rating}` }
    }
    if (l.review_count !== null && l.review_count > f.max_reviews) {
      return { lead: l, rejected: `reviews ${l.review_count} > ${f.max_reviews}` }
    }
    if (f.has_website === 'none' && l.website_url) {
      return { lead: l, rejected: `has website (filter=none)` }
    }
    if (f.has_website === 'present' && !l.website_url) {
      return { lead: l, rejected: `no website (filter=present)` }
    }
    return { lead: l, rejected: null }
  })
}

// Global dedupe across multiple area batches — prefer the first occurrence
// (which came from the highest-priority area in the input list).
export function dedupeByPlaceId(leads: PlaceLead[]): PlaceLead[] {
  const seen = new Set<string>()
  const out: PlaceLead[] = []
  for (const l of leads) {
    if (seen.has(l.place_id)) continue
    seen.add(l.place_id)
    out.push(l)
  }
  return out
}
