'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PlaceResult, ScoreResult } from '@/types/lead'
import { cn } from '@/lib/utils'

interface ScoredResult extends PlaceResult {
  scoreData?: ScoreResult
  area_label?: string | null
  area_lat?: number
  area_lng?: number
}

interface DiscoverStats {
  discovered: number
  after_top_skip: number
  after_dedupe: number
  after_filters: number
}

const NICHE_PRESETS = [
  'roofer',
  'landscaper',
  'plumber',
  'fence-installer',
  'chimney-repair',
  'hvac',
  'dental-practice',
  'cosmetic-dentist',
  'salon',
  'law-firm',
  'real-estate-agent',
  'photographer',
  'event-venue',
] as const

const inputCls =
  'flex-1 min-w-[160px] bg-background border border-border rounded-full px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors'

const SCORE_BADGE_CLS = {
  hot: 'bg-[var(--score-hot-bg)] text-[var(--score-hot-fg)]',
  warm: 'bg-[var(--score-warm-bg)] text-[var(--score-warm-fg)]',
  cold: 'bg-[var(--score-cold-bg)] text-[var(--score-cold-fg)] border border-[var(--score-cold-border)]',
}

export function SearchClient({
  initialSavedPlaceIds,
}: {
  initialSavedPlaceIds: string[]
}) {
  const router = useRouter()

  // Mode toggle: 'simple' = legacy single-business browse, 'discover' = niche+area+filters batch.
  const [mode, setMode] = useState<'simple' | 'discover'>('discover')

  // Simple-mode fields (legacy)
  const [businessType, setBusinessType] = useState('')
  const [location, setLocation] = useState('')
  const [radius, setRadius] = useState('5mi')

  // Discover-mode fields
  const [niche, setNiche] = useState<string>('roofer')
  const [customNiche, setCustomNiche] = useState('')
  const [city, setCity] = useState('')
  const [areasInput, setAreasInput] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [maxReviews, setMaxReviews] = useState(50)
  const [minRating, setMinRating] = useState(4.0)
  const [hasWebsite, setHasWebsite] = useState<'any' | 'none' | 'present'>('any')
  const [skipTopN, setSkipTopN] = useState(3)

  // Shared
  const [results, setResults] = useState<ScoredResult[]>([])
  const [discoverStats, setDiscoverStats] = useState<DiscoverStats | null>(null)
  const [savedPlaceIds, setSavedPlaceIds] = useState(
    new Set(initialSavedPlaceIds)
  )
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
  const [bulkAction, setBulkAction] = useState<'idle' | 'saving' | 'enriching'>('idle')
  const [bulkProgress, setBulkProgress] = useState<{ inserted: number; skipped: number } | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearching(true)
    setSearchError(null)
    setResults([])
    setNextPageToken(null)
    setDiscoverStats(null)
    setBulkProgress(null)
    setHasSearched(true)

    const body =
      mode === 'discover'
        ? {
            niche: niche === '__custom__' ? customNiche.trim() : niche,
            city,
            areas: areasInput
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean),
            filters: {
              max_reviews: maxReviews,
              min_rating: minRating,
              has_website: hasWebsite,
              skip_top_n: skipTopN,
            },
          }
        : { businessType, location, radius }

    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setSearching(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setSearchError(err.error ?? 'Search failed. Check your API key and try again.')
      return
    }

    const data = await res.json()
    setResults(data.results ?? [])
    setNextPageToken(data.nextPageToken ?? null)
    if (data.stats) setDiscoverStats(data.stats)
  }

  // Bulk save all unsaved results via /api/leads/bulk. Discover-mode only —
  // simple-mode results don't have niche/area_label and would create orphan rows.
  async function handleBulkSave(thenEnrich: boolean) {
    const unsaved = results.filter((r) => !savedPlaceIds.has(r.placeId))
    if (unsaved.length === 0) return

    setBulkAction(thenEnrich ? 'enriching' : 'saving')
    setBulkProgress(null)
    setSearchError(null)

    const niches = niche === '__custom__' ? customNiche.trim() : niche
    const payload = {
      leads: unsaved.map((r) => ({
        place_id: r.placeId,
        business_name: r.name,
        business_address: r.address,
        business_phone: r.phone,
        website_url: r.website,
        niche: niches,
        area_label: r.area_label ?? city,
        area_lat: r.area_lat ?? null,
        area_lng: r.area_lng ?? null,
        rating: r.rating,
        review_count: r.reviewCount,
        maps_url: r.mapsUrl,
      })),
    }

    const res = await fetch('/api/leads/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      setBulkAction('idle')
      setSearchError('Bulk save failed.')
      return
    }

    const data: { inserted: number; skipped: number; lead_ids: string[] } = await res.json()
    setBulkProgress({ inserted: data.inserted, skipped: data.skipped })

    // Mark all as saved client-side so Save buttons disappear
    setSavedPlaceIds((prev) => {
      const next = new Set(prev)
      for (const r of unsaved) next.add(r.placeId)
      return next
    })

    if (!thenEnrich) {
      setBulkAction('idle')
      router.refresh()
      return
    }

    // Enrich each newly inserted lead. Sequential to respect Anthropic rate limits.
    for (const leadId of data.lead_ids) {
      await fetch(`/api/leads/${leadId}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => null) // best-effort; UI continues
    }

    setBulkAction('idle')
    router.refresh()
  }

  async function handleLoadMore() {
    if (!nextPageToken) return
    setLoadingMore(true)

    // Google requires ~2s between page requests
    await new Promise((r) => setTimeout(r, 2000))

    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessType, location, pageToken: nextPageToken }),
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
        [result.placeId]: body.error ?? "Couldn't score this one — try again?",
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground">
          New search
        </h1>
        {/* Mode toggle */}
        <div className="flex border border-border rounded-full p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode('discover')}
            className={cn(
              'px-3 py-1 rounded-full transition-colors',
              mode === 'discover'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Discover (batch)
          </button>
          <button
            type="button"
            onClick={() => setMode('simple')}
            className={cn(
              'px-3 py-1 rounded-full transition-colors',
              mode === 'simple'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Browse (single)
          </button>
        </div>
      </div>

      {/* Search form */}
      <form
        onSubmit={handleSearch}
        className="bg-card border border-border rounded-2xl p-4 mb-6 flex flex-col gap-3"
      >
        {mode === 'simple' ? (
          <div className="flex gap-3 flex-wrap">
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
              className="bg-background border border-border rounded-full px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
            >
              <option value="1mi">1 mile</option>
              <option value="5mi">5 miles</option>
              <option value="10mi">10 miles</option>
              <option value="25mi">25 miles</option>
            </select>
            <Button type="submit" disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-3 flex-wrap">
              <select
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="bg-background border border-border rounded-full px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors min-w-[160px]"
              >
                {NICHE_PRESETS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value="__custom__">Other (custom)</option>
              </select>
              {niche === '__custom__' && (
                <input
                  type="text"
                  placeholder="Custom niche (e.g. tile-installer)"
                  value={customNiche}
                  onChange={(e) => setCustomNiche(e.target.value)}
                  required
                  className={inputCls}
                />
              )}
              <input
                type="text"
                placeholder="City (e.g. Tampa, FL)"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                className={inputCls}
              />
            </div>
            <div className="flex gap-3 flex-wrap items-center">
              <input
                type="text"
                placeholder="Areas, comma-separated (optional, blank = whole city)"
                value={areasInput}
                onChange={(e) => setAreasInput(e.target.value)}
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setShowFilters((s) => !s)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-full border border-border"
              >
                {showFilters ? '− Filters' : '+ Filters'}
              </button>
              <Button type="submit" disabled={searching}>
                {searching ? 'Discovering…' : 'Discover'}
              </Button>
            </div>
            {showFilters && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Max reviews
                  <input
                    type="number"
                    min={1}
                    value={maxReviews}
                    onChange={(e) => setMaxReviews(parseInt(e.target.value) || 50)}
                    className="bg-background border border-border rounded-full px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Min rating
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={minRating}
                    onChange={(e) => setMinRating(parseFloat(e.target.value) || 4.0)}
                    className="bg-background border border-border rounded-full px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Website
                  <select
                    value={hasWebsite}
                    onChange={(e) => setHasWebsite(e.target.value as 'any' | 'none' | 'present')}
                    className="bg-background border border-border rounded-full px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                  >
                    <option value="any">Any</option>
                    <option value="none">None only</option>
                    <option value="present">With site only</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Skip top N
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={skipTopN}
                    onChange={(e) => setSkipTopN(parseInt(e.target.value) || 0)}
                    className="bg-background border border-border rounded-full px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                </label>
              </div>
            )}
          </>
        )}
      </form>

      {/* Discover stats + bulk actions bar */}
      {mode === 'discover' && discoverStats && results.length > 0 && (
        <div className="bg-secondary/40 border border-border rounded-2xl px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-mono text-muted-foreground">
            {discoverStats.discovered} raw → {discoverStats.after_top_skip} after top-{skipTopN} skip → {discoverStats.after_dedupe} deduped → {discoverStats.after_filters} after filters
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkSave(false)}
              disabled={bulkAction !== 'idle' || results.every((r) => savedPlaceIds.has(r.placeId))}
            >
              {bulkAction === 'saving' ? 'Saving…' : 'Save all'}
            </Button>
            <Button
              size="sm"
              onClick={() => handleBulkSave(true)}
              disabled={bulkAction !== 'idle' || results.every((r) => savedPlaceIds.has(r.placeId))}
            >
              {bulkAction === 'enriching' ? 'Saving + enriching…' : 'Save all + enrich'}
            </Button>
          </div>
        </div>
      )}

      {bulkProgress && (
        <div className="bg-secondary/40 border border-border rounded-2xl px-4 py-3 mb-4 text-xs text-muted-foreground">
          Saved {bulkProgress.inserted} new lead{bulkProgress.inserted === 1 ? '' : 's'}
          {bulkProgress.skipped > 0 && `, skipped ${bulkProgress.skipped} already in pipeline`}.
        </div>
      )}

      {searchError && (
        <div className="text-destructive text-sm mb-4 bg-destructive/10 border border-destructive/20 rounded-2xl px-4 py-3">
          {searchError}
        </div>
      )}

      {/* Skeleton */}
      {searching && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl p-4 animate-pulse"
            >
              <div className="h-4 bg-secondary rounded-full w-1/3 mb-2" />
              <div className="h-3 bg-secondary/70 rounded-full w-1/2" />
            </div>
          ))}
        </div>
      )}

      {!searching && hasSearched && results.length === 0 && !searchError && (
        <p className="text-muted-foreground text-sm text-center py-10">
          No results found. Try a different search.
        </p>
      )}

      {!searching && results.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-[0.08em] mb-1">
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
                className="bg-card border border-border rounded-2xl p-4 hover:bg-secondary transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">{result.name}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{result.address}</div>
                    <div className="flex gap-3 mt-2 flex-wrap items-center">
                      {result.phone && (
                        <a
                          href={`tel:${result.phone}`}
                          className="text-xs text-foreground hover:text-muted-foreground transition-colors"
                        >
                          {result.phone}
                        </a>
                      )}
                      {result.website ? (
                        <a
                          href={result.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-foreground hover:text-muted-foreground truncate max-w-50 transition-colors"
                        >
                          {result.website}
                        </a>
                      ) : (
                        <span className="text-xs border border-border text-muted-foreground px-2 py-0.5 rounded-full">
                          No website
                        </span>
                      )}
                      {result.rating && (
                        <span className="text-xs text-muted-foreground">
                          ⭐ {result.rating} ({result.reviewCount})
                        </span>
                      )}
                      {result.mapsUrl && (
                        <a
                          href={result.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
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
                      <span className="text-xs text-muted-foreground font-medium self-center flex items-center gap-1">
                        Saved <span className="text-foreground">✓</span>
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleSave(result)}
                        disabled={isSaving}
                      >
                        {isSaving ? '…' : 'Save'}
                      </Button>
                    )}
                  </div>
                </div>

                {scoreError && (
                  <div className="mt-3 pt-3 border-t border-border text-xs text-destructive">
                    {scoreError}
                  </div>
                )}

                {scrapeNotices[result.placeId] && (
                  <div className="mt-2 text-xs text-muted-foreground bg-secondary border border-border rounded-xl px-3 py-2">
                    {scrapeNotices[result.placeId]}
                  </div>
                )}

                {scored && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={cn(
                          'text-xs px-2.5 py-1 rounded-full font-medium',
                          SCORE_BADGE_CLS[scored.score as keyof typeof SCORE_BADGE_CLS] ?? ''
                        )}
                      >
                        {scored.score}
                      </span>
                      <span className="text-xs text-muted-foreground">{scored.scoreLabel}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2.5">{scored.reasoning}</p>
                    <div className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-xs text-foreground mb-2.5">
                      &ldquo;{scored.pitch}&rdquo;
                    </div>
                    {scored.pitchBullets && scored.pitchBullets.length > 0 && (
                      <ul className="mb-2.5 pl-4 list-disc space-y-1">
                        {scored.pitchBullets.map((bullet, i) => (
                          <li key={i} className="text-xs text-muted-foreground">{bullet}</li>
                        ))}
                      </ul>
                    )}
                    {scored.siteAudit && scored.siteAudit.length > 0 && (
                      <details className="group">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1">
                          <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                          Site audit ({scored.siteAudit.length} findings)
                        </summary>
                        <ul className="mt-2 pl-4 list-disc space-y-1">
                          {scored.siteAudit.map((finding, i) => (
                            <li key={i} className="text-xs text-muted-foreground">{finding}</li>
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
