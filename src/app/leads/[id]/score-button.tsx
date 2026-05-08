'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Phase 3.5 — was "Score with AI", now triggers the combined enrichment pass
// (scrape + Claude + persist enrichments + mirror CRM fields). Single button,
// single action, populates everything: score/score_label/reasoning/pitch +
// diagnosis/site_brief/cold_message.

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleEnrich() {
    setLoading(true)
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

    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          onClick={handleEnrich}
          disabled={loading}
          className="text-sm px-5 py-2 bg-primary text-primary-foreground rounded-full hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {loading ? 'Enriching…' : '✦ Enrich with AI'}
        </button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  )
}
