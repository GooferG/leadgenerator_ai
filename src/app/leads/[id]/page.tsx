import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { Lead, Score } from '@/types/lead'
import Link from 'next/link'
import { LeadActions } from './lead-actions'
import { ScoreButton } from './score-button'

const SCORE_BADGE: Record<Score, string> = {
  hot: 'bg-amber-900/40 text-amber-400 border border-amber-800/50',
  warm: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/50',
  cold: 'bg-blue-900/40 text-blue-400 border border-blue-800/50',
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
    .select('*')
    .eq('id', id)
    .eq('user_id', session!.user.id)
    .single()

  if (!data) notFound()

  const lead = data as Lead

  return (
    <div className="max-w-2xl mx-auto p-6 animate-fade-up">
      <Link
        href="/dashboard"
        className="text-sm text-zinc-500 hover:text-zinc-300 mb-5 inline-block transition-colors"
      >
        ← Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold text-zinc-100">
            {lead.name}
          </h1>
          <p className="text-zinc-500 mt-0.5">{lead.address}</p>
        </div>
        {lead.score && (
          <span
            className={`mt-1 text-xs px-2.5 py-1 rounded-full font-medium shrink-0 border ${SCORE_BADGE[lead.score]}`}
          >
            {lead.score}
          </span>
        )}
      </div>

      {/* Contact info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Contact
        </h2>
        <div className="flex flex-col gap-2">
          {lead.phone ? (
            <a
              href={`tel:${lead.phone}`}
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              📞 {lead.phone}
            </a>
          ) : (
            <span className="text-sm text-zinc-600">No phone listed</span>
          )}
          {lead.website ? (
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-emerald-400 hover:text-emerald-300 break-all transition-colors"
            >
              🌐 {lead.website}
            </a>
          ) : (
            <span className="text-sm text-zinc-600">No website</span>
          )}
          {lead.maps_url && (
            <a
              href={lead.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              📍 View on Google Maps
            </a>
          )}
        </div>
      </div>

      {/* AI Analysis */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-3">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          AI Analysis
        </h2>
        {lead.score ? (
          <>
            {lead.score_label && (
              <div className="text-sm font-medium text-zinc-200 mb-2">
                {lead.score_label}
              </div>
            )}
            {lead.reasoning && (
              <p className="text-sm text-zinc-400 mb-3">{lead.reasoning}</p>
            )}
            {lead.pitch && (
              <div className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg px-4 py-3">
                <div className="text-xs text-zinc-500 mb-1.5 uppercase tracking-wider">
                  Suggested pitch
                </div>
                <p className="text-sm text-zinc-300 italic">
                  &ldquo;{lead.pitch}&rdquo;
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-500 mb-3">
              No score yet. Run AI analysis to evaluate this lead.
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
          </>
        )}
      </div>

      {/* Pipeline actions */}
      <LeadActions
        leadId={lead.id}
        status={lead.status}
        notes={lead.notes ?? ''}
      />
    </div>
  )
}
