import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Lead, Score, LeadStatus } from '@/types/lead'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SCORE_BADGE: Record<Score, string> = {
  hot: 'bg-amber-900/40 text-amber-400 border border-amber-800/50',
  warm: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/50',
  cold: 'bg-blue-900/40 text-blue-400 border border-blue-800/50',
}

const STATUS_BADGE: Record<LeadStatus, string> = {
  new: 'bg-zinc-800 text-zinc-400',
  contacted: 'bg-amber-900/40 text-amber-400 border border-amber-800/50',
  converted: 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50',
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
      <div className="grid grid-cols-3 gap-3 mb-8 animate-stagger-1">
        <Link
          href="/dashboard"
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors"
        >
          <div className="text-3xl font-heading font-bold text-zinc-100 mb-1 tabular-nums">
            {total ?? 0}
          </div>
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Total leads</div>
        </Link>

        <Link
          href="/dashboard?filter=hot"
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-amber-800/50 transition-colors"
        >
          <div className="text-3xl font-heading font-bold text-amber-400 mb-1 tabular-nums">
            {hotCount ?? 0}
          </div>
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Hot leads</div>
        </Link>

        <Link
          href="/dashboard?filter=contacted"
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-emerald-800/50 transition-colors"
        >
          <div className="text-3xl font-heading font-bold text-emerald-400 mb-1 tabular-nums">
            {contactedCount ?? 0}
          </div>
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Contacted</div>
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex gap-1.5 mb-5 flex-wrap animate-stagger-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === 'all' ? '/dashboard' : `/dashboard?filter=${f}`}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize',
              filter === f || (!filter && f === 'all')
                ? 'bg-zinc-100 text-zinc-900'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
            )}
          >
            {f}
          </Link>
        ))}
      </div>

      {/* Leads list */}
      {!leads?.length ? (
        <div className="text-center py-16 text-zinc-500 animate-stagger-3">
          <p className="mb-4 text-sm">
            No leads yet{filter && filter !== 'all' ? ` matching "${filter}"` : ''}.
          </p>
          <Link href="/search" className={buttonVariants()}>
            Search for leads
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2 animate-stagger-3">
          {leads.map((lead: Lead) => (
            <Link
              key={lead.id}
              href={`/leads/${lead.id}`}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 flex items-center justify-between hover:border-zinc-700 hover:bg-zinc-800/40 transition-all"
            >
              <div className="min-w-0">
                <div className="font-medium text-zinc-100 truncate">{lead.name}</div>
                <div className="text-sm text-zinc-500 truncate">{lead.address}</div>
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
