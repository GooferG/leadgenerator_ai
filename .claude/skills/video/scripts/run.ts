// Video skill orchestrator.
// Pulls mockup_ready leads, records each mockup's walkthrough, transcodes,
// uploads, and POSTs metadata back to Hook.

import { resolve } from 'node:path'
import { config as loadEnv } from 'dotenv'

import { fetchMockupReadyLeads } from './fetch-mockups'
import { recordWalkthrough } from './record-walkthrough'
import { transcodeWebmToMp4 } from './transcode'
import { uploadMp4, buildStorageKey } from './upload'
import { pushVideo } from './push-video'
import type { VideoResult } from './types'

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
    batch_size: parseInt(get('--batch-size') ?? '5', 10),
    niche: get('--niche'),
    area_label: get('--area-label'),
  }
}

function pickPublishedMockup(lead: { mockups?: Array<{ id: string; slug: string; published_at: string | null }> | null }) {
  if (!lead.mockups?.length) return null
  return lead.mockups.find((m) => m.published_at) ?? null
}

async function processOne(
  lead: { id: string; business_name: string | null; name: string | null; niche: string | null; mockups?: Array<{ id: string; slug: string; published_at: string | null }> | null },
  publicBaseUrl: string
): Promise<VideoResult> {
  const label = lead.business_name ?? lead.name ?? lead.id
  const mockup = pickPublishedMockup(lead)
  if (!mockup) {
    return { lead_id: lead.id, outcome: 'skipped', reason: 'no published mockup' }
  }

  const url = `${publicBaseUrl}/m/${mockup.slug}`
  const businessName = lead.business_name ?? lead.name ?? lead.id
  const storageKey = buildStorageKey({ niche: lead.niche, businessName })
  const localBase = `${storageKey.replace(/\//g, '_').replace(/\.mp4$/, '')}`

  process.stdout.write(`  recording ${url} ... `)
  const { webmPath, durationSeconds } = await recordWalkthrough({
    url,
    outputName: localBase,
  })
  process.stdout.write('transcoding ... ')

  const mp4Path = webmPath.replace(/\.webm$/, '.mp4')
  await transcodeWebmToMp4({ webmPath, mp4Path })

  process.stdout.write('uploading ... ')
  const { storage_path, public_url } = await uploadMp4({
    mp4Path,
    storageKey,
  })

  process.stdout.write('persisting ... ')
  await pushVideo({
    lead_id: lead.id,
    mockup_id: mockup.id,
    storage_path,
    public_url,
    duration_seconds: durationSeconds,
  })

  console.log('done')
  console.log(`    ${public_url}`)

  return { lead_id: lead.id, outcome: 'created', public_url }
}

async function main() {
  const args = parseArgs()

  const publicBaseUrl =
    process.env.HOOK_PUBLIC_BASE_URL ??
    process.env.HOOK_API_BASE_URL ??
    'http://localhost:3000'

  console.log(`[video] fetching up to ${args.batch_size} mockup_ready lead(s)...`)
  const leads = await fetchMockupReadyLeads({
    batch_size: args.batch_size,
    niche: args.niche,
    area_label: args.area_label,
  })
  console.log(`[video] got ${leads.length} lead(s)`)

  if (leads.length === 0) {
    console.log('[video] nothing to do')
    return
  }

  const results: VideoResult[] = []
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    const label = lead.business_name ?? lead.name ?? lead.id
    console.log(`  [${i + 1}/${leads.length}] ${label}`)
    try {
      const r = await processOne(lead, publicBaseUrl)
      results.push(r)
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      console.log(`    FAILED — ${msg}`)
      results.push({ lead_id: lead.id, outcome: 'failed', reason: msg })
    }
  }

  const summary = {
    processed: results.length,
    created: results.filter((r) => r.outcome === 'created').length,
    skipped: results.filter((r) => r.outcome === 'skipped').length,
    failed: results.filter((r) => r.outcome === 'failed').length,
  }
  console.log('[video] done')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((err) => {
  console.error('[video] FAILED:', (err as Error).message ?? err)
  process.exit(1)
})
