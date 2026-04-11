import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { Lead, Score } from '@/types/lead'
import Link from 'next/link'
import { LeadActions } from './lead-actions'

const SCORE_BADGE: Record<Score, string> = {
  hot: 'bg-green-100 text-green-800',
  warm: 'bg-yellow-100 text-yellow-800',
  cold: 'bg-red-100 text-red-800',
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
    <div className="max-w-2xl mx-auto p-6">
      <Link
        href="/dashboard"
        className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-block"
      >
        ← Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900">{lead.name}</h1>
          <p className="text-slate-500">{lead.address}</p>
        </div>
        {lead.score && (
          <span
            className={`mt-1 text-sm px-3 py-1 rounded-full font-medium shrink-0 ${
              SCORE_BADGE[lead.score]
            }`}
          >
            {lead.score}
          </span>
        )}
      </div>

      {/* Contact info */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Contact
        </h2>
        <div className="flex flex-col gap-2">
          {lead.phone ? (
            <a
              href={`tel:${lead.phone}`}
              className="text-sm text-indigo-600 hover:underline"
            >
              📞 {lead.phone}
            </a>
          ) : (
            <span className="text-sm text-slate-400">No phone listed</span>
          )}
          {lead.website ? (
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-600 hover:underline break-all"
            >
              🌐 {lead.website}
            </a>
          ) : (
            <span className="text-sm text-slate-400">No website</span>
          )}
          {lead.maps_url && (
            <a
              href={lead.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              📍 View on Google Maps
            </a>
          )}
        </div>
      </div>

      {/* AI Analysis */}
      {lead.score && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            AI Analysis
          </h2>
          {lead.score_label && (
            <div className="text-sm font-medium text-slate-700 mb-2">
              {lead.score_label}
            </div>
          )}
          {lead.reasoning && (
            <p className="text-sm text-slate-600 mb-3">{lead.reasoning}</p>
          )}
          {lead.pitch && (
            <div className="bg-slate-50 rounded-md px-4 py-3">
              <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">
                Suggested pitch
              </div>
              <p className="text-sm text-slate-700 italic">
                &ldquo;{lead.pitch}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pipeline actions */}
      <LeadActions
        leadId={lead.id}
        status={lead.status}
        notes={lead.notes ?? ''}
      />
    </div>
  )
}
