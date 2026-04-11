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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleScore() {
    setLoading(true)
    setError(null)

    const scoreRes = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: lead.name,
        address: lead.address,
        website: lead.website,
        phone: lead.phone,
        businessType: '',
      }),
    })

    if (!scoreRes.ok) {
      const body = await scoreRes.json().catch(() => ({ error: 'Scoring failed' }))
      setError(body.error ?? 'Scoring failed')
      setLoading(false)
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
      }),
    })

    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleScore}
        disabled={loading}
        className="text-sm px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Scoring…' : '✦ Score with AI'}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
