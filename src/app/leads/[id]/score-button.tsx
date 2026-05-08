'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EnrichProgress } from '@/components/enrich-progress'

// Phase 3.5 — was "Score with AI", now triggers the combined enrichment pass
// (scrape + Hook AI + persist enrichments + mirror CRM fields). Single button,
// single action, populates everything: score/score_label/reasoning/pitch +
// diagnosis/site_brief/cold_message.
//
// Phase 4.x — phased progress strip below the button while loading.

export function ScoreButton({
  lead,
  alreadyEnriched = false,
}: {
  lead: {
    id: string
    name: string
    address: string | null
    website: string | null
    phone: string | null
  }
  // When true, button labels itself "Re-enrich" and surfaces a hint that
  // re-running is additive (creates a new enrichment row, keeps history).
  alreadyEnriched?: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleEnrich() {
    setLoading(true)
    setDone(false)
    setError(null)

    const res = await fetch(`/api/leads/${lead.id}/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    setLoading(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Enrichment failed' }))
      setError(body.error ?? "Couldn't enrich this one — try again?")
      return
    }

    setDone(true)
    // Give the progress strip a beat to snap to 100% before refreshing
    setTimeout(() => router.refresh(), 600)
  }

  const idleLabel = alreadyEnriched ? '↻ Re-enrich' : '✦ Enrich with AI'
  const loadingLabel = alreadyEnriched ? 'Re-enriching…' : 'Enriching…'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleEnrich}
          disabled={loading}
          title={
            alreadyEnriched
              ? 'Generates a fresh enrichment. Old runs are preserved as history.'
              : undefined
          }
          className="text-sm px-5 py-2 bg-primary text-primary-foreground rounded-full hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {loading ? loadingLabel : idleLabel}
        </button>
        {alreadyEnriched && !loading && (
          <span className="text-xs text-muted-foreground">
            Keeps history; latest run wins on the page.
          </span>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
      <EnrichProgress active={loading} hasWebsite={!!lead.website} done={done} />
    </div>
  )
}
