// Enrichment skill orchestrator.
// Pulls discovered leads from Hook, calls Claude per lead, posts the result back.
//
// Usage:
//   npx tsx .claude/skills/enrich/scripts/run.ts
//   npx tsx .claude/skills/enrich/scripts/run.ts --batch-size 20
//   npx tsx .claude/skills/enrich/scripts/run.ts --niche cosmetic-dentist --area-label "West Austin"

import { resolve } from 'node:path'
import { config as loadEnv } from 'dotenv'

import { fetchDiscoveredLeads } from './fetch-discovered'
import { enrichWithClaude } from './call-claude'
import { pushEnrichment } from './push-enrichment'
import type { EnrichmentResult } from './types'

loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env') })

interface Args {
  batch_size: number
  niche?: string
  area_label?: string
  dry_run: boolean
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  return {
    batch_size: parseInt(get('--batch-size') ?? '5', 10),
    niche: get('--niche'),
    area_label: get('--area-label'),
    dry_run: argv.includes('--dry-run'),
  }
}

async function main() {
  const args = parseArgs()
  console.log(`[enrich] fetching up to ${args.batch_size} discovered leads...`)
  const leads = await fetchDiscoveredLeads({
    batch_size: args.batch_size,
    niche: args.niche,
    area_label: args.area_label,
  })
  console.log(`[enrich] got ${leads.length} lead(s)`)

  if (leads.length === 0) {
    console.log('[enrich] nothing to do')
    return
  }

  const results: EnrichmentResult[] = []

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    const label = lead.business_name ?? lead.name ?? lead.id
    process.stdout.write(`  [${i + 1}/${leads.length}] ${label}: `)

    try {
      const { enrichment, modelVersion } = await enrichWithClaude(lead)

      if (args.dry_run) {
        console.log(enrichment.is_chain ? `CHAIN — ${enrichment.chain_flag_reason}` : 'OK (dry-run, not posted)')
        if (!enrichment.is_chain) {
          console.log('    diagnosis:', enrichment.diagnosis)
          console.log('    cold_message:', enrichment.cold_message)
        }
        results.push({
          lead_id: lead.id,
          outcome: enrichment.is_chain ? 'archived_chain' : 'enriched',
        })
        continue
      }

      await pushEnrichment({
        lead_id: lead.id,
        enrichment,
        model_version: modelVersion,
      })

      if (enrichment.is_chain) {
        console.log(`CHAIN — ${enrichment.chain_flag_reason}`)
        results.push({ lead_id: lead.id, outcome: 'archived_chain' })
      } else {
        console.log('enriched')
        results.push({ lead_id: lead.id, outcome: 'enriched' })
      }
    } catch (err) {
      const msg = (err as Error).message
      console.log(`FAILED — ${msg}`)
      results.push({ lead_id: lead.id, outcome: 'failed', reason: msg })
    }
  }

  const summary = {
    processed: results.length,
    enriched: results.filter((r) => r.outcome === 'enriched').length,
    archived_chains: results.filter((r) => r.outcome === 'archived_chain').length,
    failed: results.filter((r) => r.outcome === 'failed').length,
  }
  console.log('[enrich] done')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((err) => {
  console.error('[enrich] FAILED:', (err as Error).message ?? err)
  process.exit(1)
})
