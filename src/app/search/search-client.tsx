'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PlaceResult, ScoreResult } from '@/types/lead'

interface ScoredResult extends PlaceResult {
  scoreData?: ScoreResult
}

export function SearchClient({
  initialSavedPlaceIds,
}: {
  initialSavedPlaceIds: string[]
}) {
  const [businessType, setBusinessType] = useState('')
  const [location, setLocation] = useState('')
  const [radius, setRadius] = useState('5mi')
  const [results, setResults] = useState<ScoredResult[]>([])
  const [savedPlaceIds, setSavedPlaceIds] = useState(
    new Set(initialSavedPlaceIds)
  )
  const [scoringId, setScoringId] = useState<string | null>(null)
  const [scoreErrors, setScoreErrors] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearching(true)
    setSearchError(null)
    setResults([])
    setHasSearched(true)

    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessType, location, radius }),
    })

    setSearching(false)

    if (!res.ok) {
      setSearchError('Search failed. Check your API key and try again.')
      return
    }

    const data: PlaceResult[] = await res.json()
    setResults(data)
  }

  async function handleScore(result: ScoredResult) {
    setScoringId(result.placeId)
    setScoreErrors((prev) => { const next = { ...prev }; delete next[result.placeId]; return next })

    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...result, businessType }),
    })

    setScoringId(null)

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }))
      setScoreErrors((prev) => ({ ...prev, [result.placeId]: body.error ?? 'Scoring failed' }))
      return
    }

    const scoreData: ScoreResult = await res.json()
    setResults((prev) =>
      prev.map((r) =>
        r.placeId === result.placeId ? { ...r, scoreData } : r
      )
    )
  }

  async function handleSave(result: ScoredResult) {
    setSavingId(result.placeId)

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placeId: result.placeId,
        name: result.name,
        address: result.address,
        phone: result.phone,
        website: result.website,
        mapsUrl: result.mapsUrl,
        score: result.scoreData?.score ?? null,
        scoreLabel: result.scoreData?.scoreLabel ?? null,
        reasoning: result.scoreData?.reasoning ?? null,
        pitch: result.scoreData?.pitch ?? null,
      }),
    })

    setSavingId(null)

    // 201 = saved, 409 = already saved — both mean it's in the pipeline
    if (res.ok || res.status === 409) {
      setSavedPlaceIds((prev) => new Set([...prev, result.placeId]))
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Find Leads</h1>

      <form
        onSubmit={handleSearch}
        className="bg-white border border-slate-200 rounded-lg p-4 flex gap-3 mb-6 flex-wrap"
      >
        <input
          type="text"
          placeholder="Business type (e.g. restaurants)"
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          required
          className="flex-1 min-w-[160px] border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="text"
          placeholder="Location (e.g. Tampa, FL)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          className="flex-1 min-w-[160px] border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="1mi">1 mile</option>
          <option value="5mi">5 miles</option>
          <option value="10mi">10 miles</option>
          <option value="25mi">25 miles</option>
        </select>
        <Button type="submit" disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {searchError && (
        <div className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          {searchError}
        </div>
      )}

      {searching && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-lg p-4 animate-pulse"
            >
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {!searching && hasSearched && results.length === 0 && !searchError && (
        <p className="text-slate-500 text-sm text-center py-8">
          No results found. Try a different search.
        </p>
      )}

      {!searching && results.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-500">{results.length} results</p>
          {results.map((result) => {
            const isSaved = savedPlaceIds.has(result.placeId)
            const isScoring = scoringId === result.placeId
            const isSaving = savingId === result.placeId
            const scored = result.scoreData
            const scoreError = scoreErrors[result.placeId]

            return (
              <div
                key={result.placeId}
                className="bg-white border border-slate-200 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{result.name}</div>
                    <div className="text-sm text-slate-500">{result.address}</div>
                    <div className="flex gap-3 mt-1 flex-wrap items-center">
                      {result.phone && (
                        <a
                          href={`tel:${result.phone}`}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          {result.phone}
                        </a>
                      )}
                      {result.website ? (
                        <a
                          href={result.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:underline truncate max-w-[200px]"
                        >
                          {result.website}
                        </a>
                      ) : (
                        <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">
                          No website
                        </span>
                      )}
                      {result.rating && (
                        <span className="text-xs text-slate-400">
                          ⭐ {result.rating} ({result.reviewCount})
                        </span>
                      )}
                      {result.mapsUrl && (
                        <a
                          href={result.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          Maps ↗
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!scored && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleScore(result)}
                        disabled={isScoring}
                      >
                        {isScoring ? '…' : '✦ Score'}
                      </Button>
                    )}
                    {isSaved ? (
                      <span className="text-xs text-green-600 font-medium self-center">
                        Saved ✓
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleSave(result)}
                        disabled={isSaving}
                      >
                        {isSaving ? '…' : '+ Save'}
                      </Button>
                    )}
                  </div>
                </div>

                {scoreError && (
                  <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-red-600">
                    Scoring failed: {scoreError}
                  </div>
                )}

                {scored && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          scored.score === 'hot'
                            ? 'bg-green-100 text-green-800'
                            : scored.score === 'warm'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {scored.score}
                      </span>
                      <span className="text-xs text-slate-500">
                        {scored.scoreLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-2">{scored.reasoning}</p>
                    <div className="bg-slate-50 rounded px-3 py-2 text-xs text-slate-700 italic">
                      &ldquo;{scored.pitch}&rdquo;
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
