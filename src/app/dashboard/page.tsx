import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Lead, Score, LeadStatus } from '@/types/lead'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SCORE_BADGE: Record<Score, string> = {
  hot: 'bg-green-100 text-green-800',
  warm: 'bg-yellow-100 text-yellow-800',
  cold: 'bg-red-100 text-red-800',
}

const STATUS_BADGE: Record<LeadStatus, string> = {
  new: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  contacted: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  converted: 'bg-green-50 text-green-700 border border-green-200',
}

const FILTERS = ['all', 'hot', 'warm', 'cold', 'contacted', 'converted'] as const

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const session = await auth()
  const { filter } = await searchParams
  const userId = session!.user.id

  const [{ count: total }, { count: hotCount }, { count: contactedCount }] =
    await Promise.all([
      supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('score', 'hot'),
      supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'contacted'),
    ])

  let query = supabaseAdmin
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (filter === 'hot' || filter === 'warm' || filter === 'cold') {
    query = query.eq('score', filter)
  } else if (filter === 'contacted' || filter === 'converted') {
    query = query.eq('status', filter)
  }

  const { data: leads } = await query

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Link
          href="/dashboard"
          className="bg-white border border-slate-200 rounded-lg p-4 text-center hover:border-slate-300 transition-colors"
        >
          <div className="text-2xl font-bold text-slate-900">{total ?? 0}</div>
          <div className="text-sm text-slate-500 mt-1">Total leads</div>
        </Link>
        <Link
          href="/dashboard?filter=hot"
          className="bg-white border border-slate-200 rounded-lg p-4 text-center hover:border-slate-300 transition-colors"
        >
          <div className="text-2xl font-bold text-green-600">{hotCount ?? 0}</div>
          <div className="text-sm text-slate-500 mt-1">Hot leads</div>
        </Link>
        <Link
          href="/dashboard?filter=contacted"
          className="bg-white border border-slate-200 rounded-lg p-4 text-center hover:border-slate-300 transition-colors"
        >
          <div className="text-2xl font-bold text-blue-600">{contactedCount ?? 0}</div>
          <div className="text-sm text-slate-500 mt-1">Contacted</div>
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === 'all' ? '/dashboard' : `/dashboard?filter=${f}`}
            className={cn(
              'px-3 py-1 rounded-full text-sm border transition-colors capitalize',
              filter === f || (!filter && f === 'all')
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            )}
          >
            {f}
          </Link>
        ))}
      </div>

      {/* Leads list */}
      {!leads?.length ? (
        <div className="text-center py-16 text-slate-500">
          <p className="mb-4">
            No leads yet{filter && filter !== 'all' ? ` matching "${filter}"` : ''}.
          </p>
          <Link href="/search" className={buttonVariants()}>
            Search for leads
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {leads.map((lead: Lead) => (
            <Link
              key={lead.id}
              href={`/leads/${lead.id}`}
              className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between hover:border-slate-300 transition-colors"
            >
              <div className="min-w-0">
                <div className="font-medium text-slate-900 truncate">{lead.name}</div>
                <div className="text-sm text-slate-500 truncate">{lead.address}</div>
                {lead.phone && (
                  <div className="text-xs text-slate-400">{lead.phone}</div>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                {lead.score && (
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      SCORE_BADGE[lead.score]
                    )}
                  >
                    {lead.score}
                  </span>
                )}
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    STATUS_BADGE[lead.status]
                  )}
                >
                  {lead.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
