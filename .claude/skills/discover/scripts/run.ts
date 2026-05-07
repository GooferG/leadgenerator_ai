// Discover skill orchestrator.
// Reads input (CLI args or --config <file>), runs the pipeline, and prints a summary.
//
// Usage:
//   npx tsx .claude/skills/discover/scripts/run.ts \
//     --niche cosmetic-dentist --city "Austin, TX" --area "West Austin"
//
//   npx tsx .claude/skills/discover/scripts/run.ts --config sample-input.json

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config as loadEnv } from 'dotenv'

import { geocode } from './geocode'
import { searchPlacesPaged } from './places-search'
import { applyFilters, dedupeByPlaceId, explainFilters, skipTopN } from './filter-leads'
import { pushToHook } from './push-to-hook'
import type { DiscoverInput, PlaceLead } from './types'

// Load .env.local first (Next.js convention), then .env as fallback.
// dotenv silently no-ops on missing files, so order matters: .env.local wins.
loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env') })

function parseArgs(): DiscoverInput {
  const args = Object.fromEntries(
    process.argv.slice(2).reduce<string[][]>((acc, cur, i, arr) => {
      if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]])
      return acc
    }, [])
  )

  if (args.config) {
    const raw = readFileSync(resolve(args.config), 'utf-8')
    return JSON.parse(raw) as DiscoverInput
  }

  if (!args.niche || !args.city) {
    throw new Error('Required: --niche <q> --city <q> [--area <q>] OR --config <file>')
  }

  return {
    niche: args.niche,
    city: args.city,
    areas: args.area ? [args.area] : undefined,
  }
}

const DEBUG = process.argv.includes('--debug')

function defaultRadius(input: DiscoverInput): number {
  if (input.per_area_radius_m) return input.per_area_radius_m
  return input.areas?.length ? 5_000 : 15_000 // 5km neighborhood vs 15km city-wide
}

async function main() {
  const input = parseArgs()
  const radius = defaultRadius(input)
  const target = input.target_per_area ?? 30
  const skipTop = input.filters?.skip_top_n ?? 3

  // 1. Geocode each area (or fall back to city)
  const areaQueries = input.areas?.length
    ? input.areas.map((a) => `${a}, ${input.city}`)
    : [input.city]

  console.log(`[discover] geocoding ${areaQueries.length} area(s)...`)
  const points = await Promise.all(areaQueries.map((q) => geocode(q)))

  // 2. Search each area with location bias
  console.log(`[discover] searching Places (radius=${radius}m, target=${target})...`)
  const perArea: PlaceLead[][] = []
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    process.stdout.write(`  [${i + 1}/${points.length}] ${p.area_label}: `)
    try {
      const results = await searchPlacesPaged({
        niche: input.niche,
        lat: p.lat,
        lng: p.lng,
        radius_m: radius,
        target,
      })
      console.log(`${results.length} raw`)
      // Annotate each result with the area it came from
      const annotated = results.map((r) => ({
        ...r,
        niche: input.niche,
        area_label: p.area_label,
        area_lat: p.lat,
        area_lng: p.lng,
      }))
      perArea.push(annotated)
    } catch (err) {
      const e = err as { code?: string; message?: string }
      if (e.code === 'THROTTLED') {
        console.log('THROTTLED — waiting 10s and retrying once')
        await new Promise((r) => setTimeout(r, 10_000))
        // single retry; fail loud if still throttled
        const results = await searchPlacesPaged({
          niche: input.niche,
          lat: p.lat,
          lng: p.lng,
          radius_m: radius,
          target,
        })
        const annotated = results.map((r) => ({
          ...r,
          niche: input.niche,
          area_label: p.area_label,
          area_lat: p.lat,
          area_lng: p.lng,
        }))
        perArea.push(annotated)
      } else {
        throw err
      }
    }
  }

  const discovered = perArea.reduce((sum, a) => sum + a.length, 0)

  // 3. Skip top N per area (heuristic: dominant players don't need a new site)
  const trimmedPerArea = perArea.map((area) => skipTopN(area, skipTop))
  const afterTopSkip = trimmedPerArea.reduce((sum, a) => sum + a.length, 0)

  // 4. Combine + dedupe by place_id (a business indexed under multiple areas wins for the first one)
  const combined = dedupeByPlaceId(trimmedPerArea.flat())

  // 5. Apply filters (rating, review count, website presence)
  if (DEBUG) {
    const explained = explainFilters(combined, input.filters)
    console.log('[discover] filter breakdown:')
    for (const { lead, rejected } of explained) {
      const tag = rejected ? `REJECT (${rejected})` : 'KEEP'
      console.log(`  ${tag}  ${lead.business_name}  rating=${lead.rating} reviews=${lead.review_count} website=${lead.website_url ? 'yes' : 'no'}`)
    }
  }
  const filtered = applyFilters(combined, input.filters)
  const afterFilters = filtered.length

  console.log(
    `[discover] ${discovered} raw -> ${afterTopSkip} after top-${skipTop} skip -> ${combined.length} deduped -> ${afterFilters} after filters`
  )

  if (afterFilters === 0) {
    console.log('[discover] nothing to insert; exiting')
    console.log(JSON.stringify({ discovered, after_top_skip: afterTopSkip, after_filters: 0, inserted: 0, skipped_existing: 0 }, null, 2))
    return
  }

  // 6. Push to Hook
  console.log(`[discover] POST /api/leads/bulk (${afterFilters} leads)...`)
  const result = await pushToHook({ leads: filtered })

  // 7. Summary
  const summary = {
    discovered,
    after_top_skip: afterTopSkip,
    after_filters: afterFilters,
    inserted: result.inserted,
    skipped_existing: result.skipped,
  }
  console.log('[discover] done')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((err) => {
  console.error('[discover] FAILED:', err.message ?? err)
  process.exit(1)
})
