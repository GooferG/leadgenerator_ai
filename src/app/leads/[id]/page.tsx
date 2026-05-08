import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { Lead, Score } from '@/types/lead'
import Link from 'next/link'
import { LeadActions } from './lead-actions'
import { ScoreButton } from './score-button'
import { cn } from '@/lib/utils'

const SCORE_BADGE: Record<Score, string> = {
  hot: 'bg-[var(--score-hot-bg)] text-[var(--score-hot-fg)]',
  warm: 'bg-[var(--score-warm-bg)] text-[var(--score-warm-fg)]',
  cold: 'bg-[var(--score-cold-bg)] text-[var(--score-cold-fg)] border border-[var(--score-cold-border)]',
}

const WHY_LABEL: Record<Score, string> = {
  hot: 'Why hot',
  warm: 'Why warm',
  cold: 'Why cold',
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const { id } = await params

  const { data } = await supabaseAdmin
    .from('leads')
    .select('*, enrichments(*), mockups(*), videos(*)')
    .eq('id', id)
    .eq('user_id', session!.user.id)
    .single()

  if (!data) notFound()

  const lead = data as Lead & {
    enrichments?: Array<{
      id: string
      diagnosis: string | null
      cold_message: string | null
      site_brief: Record<string, unknown> | null
      chain_flag_reason: string | null
      created_at: string
    }>
    mockups?: Array<{
      id: string
      slug: string
      published_at: string | null
      created_at: string
    }>
    videos?: Array<{
      id: string
      public_url: string
      duration_seconds: number | null
      created_at: string
    }>
  }

  // Pick the most recent of each related row
  const enrichment = lead.enrichments?.[0] ?? null
  const mockup = lead.mockups?.find((m) => m.published_at) ?? null
  const video = lead.videos?.[0] ?? null

  return (
    <div className="max-w-5xl mx-auto p-6 animate-fade-up">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground hover:text-foreground mb-5 inline-block transition-colors"
      >
        ← Dashboard
      </Link>

      <div className="grid grid-cols-[1fr_360px] gap-5 items-start">
        {/* Left column */}
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-secondary border border-border flex items-center justify-center text-sm font-semibold text-muted-foreground shrink-0">
              {initials(lead.name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-sans text-2xl font-semibold text-foreground tracking-tight">
                  {lead.name}
                </h1>
                {lead.score && (
                  <span
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-full font-medium shrink-0',
                      SCORE_BADGE[lead.score]
                    )}
                  >
                    {lead.score}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground mt-0.5 text-sm">{lead.address}</p>
            </div>
          </div>

          {/* Unified enrichment panel — single source of truth.
              Phase 3.5 collapsed two flows (legacy /api/score and the enrich
              skill) into one Claude call. The page now reflects that: instead
              of separate "Cold open" / "Why warm" / "Site audit" / "Enrichment"
              cards, everything lives in one panel in the order Claude generated:
              score+reasoning → site audit → pitch → diagnosis → cold message. */}
          {(lead.score || enrichment) ? (
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-4">
              <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-[0.08em]">
                Enrichment
              </h2>

              {enrichment?.chain_flag_reason && (
                <p className="text-xs text-muted-foreground bg-secondary border border-border rounded-xl px-3 py-2">
                  Chain flag: {enrichment.chain_flag_reason}
                </p>
              )}

              {/* Why hot/warm/cold — score_label + reasoning */}
              {lead.score && (
                <div>
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-[0.08em] mb-1">
                    {WHY_LABEL[lead.score]}
                  </div>
                  {lead.score_label && (
                    <div className="text-sm font-medium text-foreground mb-1">
                      {lead.score_label}
                    </div>
                  )}
                  {lead.reasoning && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{lead.reasoning}</p>
                  )}
                </div>
              )}

              {/* Site audit findings (collapsible) */}
              {lead.site_audit && lead.site_audit.length > 0 && (
                <details className="group">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1">
                    <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                    Site audit ({lead.site_audit.length} findings)
                  </summary>
                  <ul className="mt-2 pl-4 list-disc space-y-1">
                    {lead.site_audit.map((finding: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground leading-relaxed">{finding}</li>
                    ))}
                  </ul>
                </details>
              )}

              {lead.scrape_error && (
                <p className="text-xs text-muted-foreground/60">
                  Site couldn&apos;t be crawled — audit data unavailable.
                </p>
              )}

              {/* Internal pitch — short operator-facing summary */}
              {lead.pitch && (
                <div>
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-[0.08em] mb-1">
                    Pitch
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{lead.pitch}</p>
                </div>
              )}

              {/* Diagnosis — narrative ~50 words */}
              {enrichment?.diagnosis && (
                <div>
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-[0.08em] mb-1">
                    Diagnosis
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{enrichment.diagnosis}</p>
                </div>
              )}

              {/* Cold message — outbound, what gets sent to the lead */}
              {enrichment?.cold_message && (
                <div>
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-[0.08em] mb-1">
                    Cold message
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {enrichment.cold_message}
                  </p>
                </div>
              )}

              {/* Re-enrich trigger — additive (creates a new enrichments row,
                  preserves history). Latest run's content is what's rendered above. */}
              <div className="pt-3 border-t border-border">
                <ScoreButton
                  lead={{
                    id: lead.id,
                    name: lead.name,
                    address: lead.address ?? null,
                    website: lead.website ?? null,
                    phone: lead.phone ?? null,
                  }}
                  alreadyEnriched
                />
              </div>
            </div>
          ) : (
            // No enrichment yet — surface the trigger button.
            <div className="bg-card border border-border rounded-2xl p-4">
              <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-[0.08em] mb-3">
                Enrichment
              </h2>
              <p className="text-sm text-muted-foreground mb-3">
                Not enriched yet. Run AI analysis to score this lead and draft a cold open.
              </p>
              <ScoreButton
                lead={{
                  id: lead.id,
                  name: lead.name,
                  address: lead.address ?? null,
                  website: lead.website ?? null,
                  phone: lead.phone ?? null,
                }}
              />
            </div>
          )}

          {/* Pipeline outputs — mockup + walkthrough video */}
          {video && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-[0.08em]">
                  Walkthrough video
                </h2>
                {video.duration_seconds != null && (
                  <span className="text-xs text-muted-foreground">{video.duration_seconds}s</span>
                )}
              </div>
              <video
                src={video.public_url}
                controls
                preload="metadata"
                className="w-full rounded-xl border border-border bg-secondary"
              />
              <a
                href={video.public_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Open MP4 ↗
              </a>
            </div>
          )}

          {mockup && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-[0.08em]">
                  Mockup site
                </h2>
                <span className="text-xs text-muted-foreground">/{mockup.slug}</span>
              </div>
              <a
                href={`/m/${mockup.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-foreground hover:text-muted-foreground break-all transition-colors"
              >
                {`/m/${mockup.slug}`} ↗
              </a>
            </div>
          )}

        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3">
          {/* Contact info */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-[0.08em] mb-3">
              Contact
            </h2>
            <div className="flex flex-col gap-2">
              {lead.phone ? (
                <a
                  href={`tel:${lead.phone}`}
                  className="text-sm text-foreground hover:text-muted-foreground transition-colors"
                >
                  📞 {lead.phone}
                </a>
              ) : (
                <span className="text-sm text-muted-foreground/50">No phone listed</span>
              )}
              {lead.website ? (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-foreground hover:text-muted-foreground break-all transition-colors"
                >
                  🌐 {lead.website}
                </a>
              ) : (
                <span className="text-sm text-muted-foreground/50">No website</span>
              )}
              {lead.maps_url && (
                <a
                  href={lead.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  📍 View on Google Maps
                </a>
              )}
            </div>
          </div>

          {/* Pipeline actions */}
          <LeadActions
            leadId={lead.id}
            status={lead.status}
            notes={lead.notes ?? ''}
          />
        </div>
      </div>
    </div>
  )
}
