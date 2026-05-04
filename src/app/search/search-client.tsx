'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PlaceResult, ScoreResult } from '@/types/lead'

interface ScoredResult extends PlaceResult {
  scoreData?: ScoreResult
}

const inputCls =
  'flex-1 min-w-[160px] bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors'

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
  // placeId → leadId, so we can patch scoring data back after a late score
  const [savedLeadIds, setSavedLeadIds] = useState<Record<string, string>>({})
  const [scoringId, setScoringId] = useState<string | null>(null)
  const [scoringPhase, setScoringPhase] = useState<'crawling' | 'scoring' | null>(null)
  const [scrapeNotices, setScrapeNotices] = useState<Record<string, string>>({})
  const [scoreErrors, setScoreErrors] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearching(true)
    setSearchError(null)
    setResults([])
    setNextPageToken(null)
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

    const data: { results: PlaceResult[]; nextPageToken: string | null } = await res.json()
    setResults(data.results)
    setNextPageToken(data.nextPageToken)
  }

  async function handleLoadMore() {
    if (!nextPageToken) return
    setLoadingMore(true)

    // Google requires ~2s between page requests
    await new Promise((r) => setTimeout(r, 2000))

    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageToken: nextPageToken }),
    })

    setLoadingMore(false)

    if (!res.ok) {
      setSearchError('Failed to load more results.')
      return
    }

    const data: { results: PlaceResult[]; nextPageToken: string | null } = await res.json()
    setResults((prev) => [...prev, ...data.results])
    setNextPageToken(data.nextPageToken)
  }

  async function handleScore(result: ScoredResult) {
    setScoringId(result.placeId)
    setScoringPhase(null)
    setScoreErrors((prev) => {
      const next = { ...prev }
      delete next[result.placeId]
      return next
    })
    setScrapeNotices((prev) => {
      const next = { ...prev }
      delete next[result.placeId]
      return next
    })

    let siteContent = undefined

    if (result.website) {
      setScoringPhase('crawling')
      const scrapeRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: result.website }),
      })
      const scrapeData = await scrapeRes.json()

      if (scrapeData.error) {
        setScrapeNotices((prev) => ({
          ...prev,
          [result.placeId]: "Couldn't crawl site — scoring with available data instead",
        }))
      } else {
        siteContent = scrapeData.content
      }
    }

    setScoringPhase('scoring')

    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...result, businessType, siteContent }),
    })

    setScoringId(null)
    setScoringPhase(null)

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }))
      setScoreErrors((prev) => ({
        ...prev,
        [result.placeId]: body.error ?? 'Scoring failed',
      }))
      return
    }

    const scoreData: ScoreResult = await res.json()
    setResults((prev) =>
      prev.map((r) =>
        r.placeId === result.placeId ? { ...r, scoreData } : r
      )
    )

    const leadId = savedLeadIds[result.placeId]
    if (leadId) {
      await fetch(`/api/leads/${leadId}`, {
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
    }
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

    if (res.ok || res.status === 409) {
      setSavedPlaceIds((prev) => new Set([...prev, result.placeId]))
      if (res.ok) {
        const saved = await res.json().catch(() => null)
        if (saved?.id) {
          setSavedLeadIds((prev) => ({ ...prev, [result.placeId]: saved.id }))
        }
      }
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="font-heading text-2xl font-bold text-zinc-100 mb-6">
        Find Leads
      </h1>

      {/* Search form */}
      <form
        onSubmit={handleSearch}
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-3 mb-6 flex-wrap"
      >
        <input
          type="text"
          placeholder="Business type (e.g. restaurants)"
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          required
          className={inputCls}
        />
        <input
          type="text"
          placeholder="Location (e.g. Tampa, FL)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          className={inputCls}
        />
        <select
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors"
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
        <div className="text-red-400 text-sm mb-4 bg-red-900/20 border border-red-900/40 rounded-lg px-4 py-3">
          {searchError}
        </div>
      )}

      {/* Skeleton */}
      {searching && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse"
            >
              <div className="h-4 bg-zinc-800 rounded w-1/3 mb-2" />
              <div className="h-3 bg-zinc-800/70 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {!searching && hasSearched && results.length === 0 && !searchError && (
        <p className="text-zinc-500 text-sm text-center py-10">
          No results found. Try a different search.
        </p>
      )}

      {!searching && results.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            {results.length} results
          </p>
          {results.map((result) => {
            const isSaved = savedPlaceIds.has(result.placeId)
            const isScoring = scoringId === result.placeId
            const isSaving = savingId === result.placeId
            const scored = result.scoreData
            const scoreError = scoreErrors[result.placeId]

            return (
              <div
                key={result.placeId}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-100">{result.name}</div>
                    <div className="text-sm text-zinc-500 mt-0.5">{result.address}</div>
                    <div className="flex gap-3 mt-2 flex-wrap items-center">
                      {result.phone && (
                        <a
                          href={`tel:${result.phone}`}
                          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          {result.phone}
                        </a>
                      )}
                      {result.website ? (
                        <a
                          href={result.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-400 hover:text-emerald-300 truncate max-w-[200px] transition-colors"
                        >
                          {result.website}
                        </a>
                      ) : (
                        <span className="text-xs bg-red-900/30 text-red-400 border border-red-900/40 px-2 py-0.5 rounded-full">
                          No website
                        </span>
                      )}
                      {result.rating && (
                        <span className="text-xs text-zinc-500">
                          ⭐ {result.rating} ({result.reviewCount})
                        </span>
                      )}
                      {result.mapsUrl && (
                        <a
                          href={result.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
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
                        {isScoring
                          ? scoringPhase === 'crawling'
                            ? 'Crawling…'
                            : 'Scoring…'
                          : '✦ Score'}
                      </Button>
                    )}
                    {isSaved ? (
                      <span className="text-xs text-emerald-400 font-medium self-center">
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
                  <div className="mt-3 pt-3 border-t border-zinc-800 text-xs text-red-400">
                    Scoring failed: {scoreError}
                  </div>
                )}

                {scrapeNotices[result.placeId] && (
                  <div className="mt-2 text-xs text-yellow-400/80 bg-yellow-900/10 border border-yellow-900/30 rounded-lg px-3 py-2">
                    {scrapeNotices[result.placeId]}
                  </div>
                )}

                {scored && (
                  <div className="mt-3 pt-3 border-t border-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                          scored.score === 'hot'
                            ? 'bg-amber-900/40 text-amber-400 border-amber-800/50'
                            : scored.score === 'warm'
                            ? 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50'
                            : 'bg-blue-900/40 text-blue-400 border-blue-800/50'
                        }`}
                      >
                        {scored.score}
                      </span>
                      <span className="text-xs text-zinc-400">{scored.scoreLabel}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mb-2.5">{scored.reasoning}</p>
                    <div className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg px-3 py-2.5 text-xs text-zinc-300 italic mb-2.5">
                      &ldquo;{scored.pitch}&rdquo;
                    </div>
                    {scored.pitchBullets && scored.pitchBullets.length > 0 && (
                      <ul className="mb-2.5 pl-4 list-disc space-y-1">
                        {scored.pitchBullets.map((bullet, i) => (
                          <li key={i} className="text-xs text-zinc-400">{bullet}</li>
                        ))}
                      </ul>
                    )}
                    {scored.siteAudit && scored.siteAudit.length > 0 && (
                      <details className="group">
                        <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors list-none flex items-center gap-1">
                          <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                          Site Audit ({scored.siteAudit.length} findings)
                        </summary>
                        <ul className="mt-2 pl-4 list-disc space-y-1">
                          {scored.siteAudit.map((finding, i) => (
                            <li key={i} className="text-xs text-zinc-500">{finding}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {nextPageToken && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load more results'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
