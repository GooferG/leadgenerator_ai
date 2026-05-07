// Mockup skill orchestrator.
// Pulls enriched leads from Hook and creates a published mockup per lead.
//
// Usage:
//   npx tsx .claude/skills/mockup/scripts/run.ts
//   npx tsx .claude/skills/mockup/scripts/run.ts --batch-size 30
//   npx tsx .claude/skills/mockup/scripts/run.ts --niche roofer

import { resolve } from 'node:path'
import { config as loadEnv } from 'dotenv'

import { fetchEnrichedLeads } from './fetch-enriched'
import { pushMockup } from './push-mockup'
import type { MockupResult } from './types'

loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env') })

interface Args {
  batch_size: number
  niche?: string
  area_label?: string
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  return {
    batch_size: parseInt(get('--batch-size') ?? '10', 10),
    niche: get('--niche'),
    area_label: get('--area-label'),
  }
}

async function main() {
  const args = parseArgs()
  console.log(`[mockup] fetching up to ${args.batch_size} enriched lead(s)...`)
  const leads = await fetchEnrichedLeads({
    batch_size: args.batch_size,
    niche: args.niche,
    area_label: args.area_label,
  })
  console.log(`[mockup] got ${leads.length} lead(s)`)

  if (leads.length === 0) {
    console.log('[mockup] nothing to do')
    return
  }

  const results: MockupResult[] = []
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    const label = lead.business_name ?? lead.name ?? lead.id
    process.stdout.write(`  [${i + 1}/${leads.length}] ${label}: `)
    try {
      const { slug, public_url } = await pushMockup({ lead_id: lead.id })
      console.log(`created → ${public_url}`)
      results.push({ lead_id: lead.id, outcome: 'created', slug, public_url })
    } catch (err) {
      const msg = (err as Error).message
      console.log(`FAILED — ${msg}`)
      results.push({ lead_id: lead.id, outcome: 'failed', reason: msg })
    }
  }

  const summary = {
    processed: results.length,
    created: results.filter((r) => r.outcome === 'created').length,
    failed: results.filter((r) => r.outcome === 'failed').length,
  }
  console.log('[mockup] done')
  console.log(JSON.stringify(summary, null, 2))
  if (summary.created > 0) {
    console.log('\nPublic URLs:')
    for (const r of results) {
      if (r.public_url) console.log(`  ${r.public_url}`)
    }
  }
}

main().catch((err) => {
  console.error('[mockup] FAILED:', (err as Error).message ?? err)
  process.exit(1)
})
