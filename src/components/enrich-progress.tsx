'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// Phase-labeled progress bar shown during enrichment.
// The endpoint doesn't stream, so we time-pace the bar through realistic phase
// segments (scraping → Hook AI thinking → finalizing) and pin at 90% if Hook AI
// takes longer than expected. Snaps to 100% on completion, then fades.
//
// Honest about phase boundaries (those map to real server work). Slightly
// dishonest about within-phase progress (faked via easing). Industry-standard.

type Phase = 'scraping' | 'thinking' | 'finalizing' | 'done'

interface PhaseStop {
  phase: Phase
  label: string
  // The progress percentage at which this phase ends
  endsAt: number
  // Time in ms from the start of the phase to when we want to be at endsAt
  // (i.e. how long the phase realistically takes on the server)
  durationMs: number
}

const PHASES_WITH_SCRAPE: PhaseStop[] = [
  { phase: 'scraping', label: 'Scraping site…', endsAt: 25, durationMs: 2000 },
  { phase: 'thinking', label: 'Hook AI is thinking…', endsAt: 90, durationMs: 7500 },
  { phase: 'finalizing', label: 'Finalizing…', endsAt: 95, durationMs: 1500 },
]

const PHASES_NO_SCRAPE: PhaseStop[] = [
  { phase: 'thinking', label: 'Hook AI is thinking…', endsAt: 90, durationMs: 8000 },
  { phase: 'finalizing', label: 'Finalizing…', endsAt: 95, durationMs: 1500 },
]

interface Props {
  // True while the enrich request is in flight.
  active: boolean
  // Whether the lead has a website (drives whether we show the scrape phase).
  hasWebsite: boolean
  // Optional: triggers a 100% snap when set, then component fades out.
  done?: boolean
}

export function EnrichProgress({ active, hasWebsite, done }: Props) {
  const [progress, setProgress] = useState(0)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [visible, setVisible] = useState(false)

  const phases = hasWebsite ? PHASES_WITH_SCRAPE : PHASES_NO_SCRAPE

  // Start animating when active flips true. Reset when it goes back to false.
  useEffect(() => {
    if (!active && !done) {
      setProgress(0)
      setPhaseIndex(0)
      setVisible(false)
      return
    }

    setVisible(true)

    if (done) {
      // Snap to 100, then fade out after a beat.
      setProgress(100)
      const t = setTimeout(() => setVisible(false), 800)
      return () => clearTimeout(t)
    }

    // Drive progress per-phase. We use rAF-like setInterval to keep it smooth.
    let cancelled = false
    let phaseStart = Date.now()
    let phaseStartProgress = 0
    let currentPhase = 0

    const tick = () => {
      if (cancelled) return
      const phase = phases[currentPhase]
      if (!phase) return // beyond defined phases — pin at 95 (set on entry)

      const elapsed = Date.now() - phaseStart
      const ratio = Math.min(elapsed / phase.durationMs, 1)
      // Ease-out: fast at start, slow at end. Matches user's mental "thinking" pacing.
      const eased = 1 - Math.pow(1 - ratio, 2)
      const next = phaseStartProgress + (phase.endsAt - phaseStartProgress) * eased
      setProgress(next)

      if (ratio >= 1) {
        // Move to next phase
        currentPhase += 1
        setPhaseIndex(currentPhase)
        if (currentPhase < phases.length) {
          phaseStart = Date.now()
          phaseStartProgress = phase.endsAt
        }
      }
    }

    const id = setInterval(tick, 60)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [active, done, hasWebsite])

  if (!visible) return null

  const currentLabel = done
    ? 'Done'
    : phases[Math.min(phaseIndex, phases.length - 1)]?.label ?? 'Working…'

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 transition-opacity duration-300',
        done && progress >= 100 ? 'opacity-0' : 'opacity-100'
      )}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{currentLabel}</span>
        <span className="font-mono text-muted-foreground/60 tabular-nums">
          {Math.round(progress)}%
        </span>
      </div>
      {/* Track: muted neutral. Fill: full foreground (black in light mode, white
          in dark mode) for maximum contrast. Bumped to h-1.5 so the fill reads
          at a glance even at small percentages. */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-foreground transition-[width] duration-100 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
