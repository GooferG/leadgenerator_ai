// Playwright walkthrough recorder.
// Loads a mockup URL, records a scripted scroll sequence, returns the WebM file path.
//
// Standalone-runnable for debugging:
//   npx tsx .claude/skills/video/scripts/record-walkthrough.ts <url>

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const VIEWPORT = { width: 1280, height: 800 }
const RECORD_SIZE = { width: 1280, height: 720 } // 720p target output
const CACHE_DIR = '.cache/videos'

// Total runtime ~15s. Each section advances the scroll smoothly.
const SCRIPT = [
  { action: 'wait', ms: 2000 },                       // hero settle
  { action: 'scrollTo', selector: 'section', index: 1, ms: 2500 }, // services
  { action: 'wait', ms: 2000 },
  { action: 'scrollTo', selector: 'section', index: 2, ms: 2500 }, // why us
  { action: 'wait', ms: 1500 },
  { action: 'scrollTo', selector: 'section', index: 3, ms: 2500 }, // contact
  { action: 'wait', ms: 1500 },
  { action: 'scrollTo', selector: 'header', index: 0, ms: 2000 },  // back to top
] as const

interface RecordOpts {
  url: string
  outputName: string // base filename without extension
}

export async function recordWalkthrough(opts: RecordOpts): Promise<{
  webmPath: string
  durationSeconds: number
}> {
  const cacheDir = resolve(process.cwd(), CACHE_DIR)
  await mkdir(cacheDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: {
      dir: cacheDir,
      size: RECORD_SIZE,
    },
  })
  const page = await context.newPage()

  const startedAt = Date.now()

  await page.goto(opts.url, { waitUntil: 'networkidle' })

  for (const step of SCRIPT) {
    if (step.action === 'wait') {
      await page.waitForTimeout(step.ms)
    } else if (step.action === 'scrollTo') {
      // Smooth scroll to the i-th matching element so the camera "moves" rather than jumps.
      const success = await page.evaluate(
        ({ selector, index }) => {
          const elements = document.querySelectorAll(selector)
          const target = elements[index]
          if (!target) return false
          target.scrollIntoView({ behavior: 'smooth', block: 'start' })
          return true
        },
        { selector: step.selector, index: step.index }
      )
      // Wait long enough for the smooth-scroll to complete (browsers do ~500ms by default,
      // we add the configured pause so the viewer can absorb the section).
      await page.waitForTimeout(step.ms)
      if (!success) {
        // Section missing (some templates skip them). Continue without failing the run.
        console.warn(`  [warn] ${step.selector}[${step.index}] not found, skipping`)
      }
    }
  }

  const durationSeconds = Math.round((Date.now() - startedAt) / 1000)

  await page.close()
  await context.close()
  await browser.close()

  // Playwright writes the video on context.close(). The filename is auto-generated;
  // we find the most recently modified .webm in the cache dir and rename it.
  const { readdir, stat, rename } = await import('node:fs/promises')
  const entries = await readdir(cacheDir)
  const webms = entries.filter((f) => f.endsWith('.webm'))
  if (webms.length === 0) throw new Error('Playwright did not produce a .webm file')

  const stats = await Promise.all(
    webms.map(async (f) => ({ f, mtime: (await stat(resolve(cacheDir, f))).mtimeMs }))
  )
  stats.sort((a, b) => b.mtime - a.mtime)
  const newest = stats[0].f

  const targetName = `${opts.outputName}.webm`
  const targetPath = resolve(cacheDir, targetName)
  await rename(resolve(cacheDir, newest), targetPath)

  return { webmPath: targetPath, durationSeconds }
}

// Standalone CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const url = process.argv[2]
  if (!url) {
    console.error('Usage: tsx record-walkthrough.ts <url>')
    process.exit(1)
  }
  const name = `debug-${Date.now()}`
  recordWalkthrough({ url, outputName: name })
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => {
      console.error(e.message)
      process.exit(1)
    })
}
