'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ScoreButton({
  lead,
}: {
  lead: {
    id: string
    name: string
    address: string | null
    website: string | null
    phone: string | null
  }
}) {
  const router = useRouter()
  const [phase, setPhase] = useState<'crawling' | 'scoring' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scrapeNotice, setScrapeNotice] = useState<string | null>(null)

  async function handleScore() {
    setPhase(null)
    setError(null)
    setScrapeNotice(null)

    let siteContent = undefined

    if (lead.website) {
      setPhase('crawling')
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: lead.website }),
      })
      const scrapeData = await scrapeRes.json()

      if (scrapeData.error) {
        setScrapeNotice("Couldn't crawl site — scoring with available data instead")
      } else {
        siteContent = scrapeData.content
      }
    }

    setPhase('scoring')

    const scoreRes = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: lead.name,
        address: lead.address,
        website: lead.website,
        phone: lead.phone,
        businessType: '',
        siteContent,
      }),
    })

    if (!scoreRes.ok) {
      const body = await scoreRes.json().catch(() => ({ error: 'Scoring failed' }))
      setError(body.error ?? 'Scoring failed')
      setPhase(null)
      return
    }

    const scoreData = await scoreRes.json()

    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score: scoreData.score,
        score_label: scoreData.scoreLabel,
        reasoning: scoreData.reasoning,
        pitch: scoreData.pitch,
        site_audit: scoreData.siteAudit ?? null,
        scrape_error: scoreData.scrapeError ?? null,
      }),
    })

    setPhase(null)
    router.refresh()
  }

  const loading = phase !== null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          onClick={handleScore}
          disabled={loading}
          className="text-sm px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-50 transition-colors"
        >
          {phase === 'crawling'
            ? 'Crawling site…'
            : phase === 'scoring'
            ? 'Scoring…'
            : '✦ Score with AI'}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
      {scrapeNotice && (
        <p className="text-xs text-yellow-400/80">{scrapeNotice}</p>
      )}
    </div>
  )
}
