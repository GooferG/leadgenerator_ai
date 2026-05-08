// Enrichment skill orchestrator.
// Phase 3.5: now scrapes the lead's website (when available) before calling
// Claude, and produces both CRM-facing fields (score, site_audit, pitch) and
// pipeline-facing fields (diagnosis, site_brief, cold_message) in one call.
//
// Usage:
//   npx tsx .claude/skills/enrich/scripts/run.ts
//   npx tsx .claude/skills/enrich/scripts/run.ts --batch-size 20
//   npx tsx .claude/skills/enrich/scripts/run.ts --niche cosmetic-dentist --area-label "West Austin"
//   npx tsx .claude/skills/enrich/scripts/run.ts --force        # re-enrich already-enriched leads
//   npx tsx .claude/skills/enrich/scripts/run.ts --dry-run      # call Claude but don't post

import { resolve } from 'node:path'
import { config as loadEnv } from 'dotenv'

import { fetchDiscoveredLeads } from './fetch-discovered'
import { scrapeSite } from './scrape-site'
import { enrichWithClaude } from './call-claude'
import { pushEnrichment } from './push-enrichment'
import type { EnrichmentResult } from './types'

loadEnv({ path: resolve(process.cwd(), '.env.local') })
loadEnv({ path: resolve(process.cwd(), '.env') })

interface Args {
  batch_size: number
  niche?: string
  area_label?: string
  status?: string
  dry_run: boolean
  force: boolean
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
    status: get('--status'),
    dry_run: argv.includes('--dry-run'),
    force: argv.includes('--force'),
  }
}

async function main() {
  const args = parseArgs()
  // Priority: explicit --status flag > --force (re-process enriched) > default (discovered).
  // Use --status when leads have advanced past 'enriched' (mockup_ready, video_ready, etc.)
  // and you want to re-process them anyway.
  const targetStatus = args.status ?? (args.force ? 'enriched' : 'discovered')

  console.log(`[enrich] fetching up to ${args.batch_size} ${targetStatus} lead(s)...`)
  const leads = await fetchDiscoveredLeads({
    batch_size: args.batch_size,
    status: targetStatus,
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
      // 1. Scrape the lead's website if it has one
      let siteContent = null
      let scrapeErrorMsg: string | null = null
      if (lead.website) {
        process.stdout.write('scraping... ')
        const scrape = await scrapeSite({ url: lead.website })
        if (scrape.content) {
          siteContent = scrape.content
        } else {
          scrapeErrorMsg = scrape.error
        }
      }

      // 2. Claude
      process.stdout.write('claude... ')
      const { enrichment, modelVersion } = await enrichWithClaude(lead, siteContent, scrapeErrorMsg)

      // 3. Persist or dry-run
      if (args.dry_run) {
        console.log(enrichment.is_chain ? `CHAIN — ${enrichment.chain_flag_reason}` : `${enrichment.score} (dry-run)`)
        if (!enrichment.is_chain) {
          console.log('    score_label:', enrichment.score_label)
          console.log('    site_audit:', enrichment.site_audit.join(' | '))
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
        scrape_error: !!scrapeErrorMsg,
      })

      if (enrichment.is_chain) {
        console.log(`CHAIN — ${enrichment.chain_flag_reason}`)
        results.push({ lead_id: lead.id, outcome: 'archived_chain' })
      } else {
        console.log(`enriched (${enrichment.score})`)
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
