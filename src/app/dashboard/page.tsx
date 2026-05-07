import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { Lead, Score, LeadStatus } from '@/types/lead'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const SCORE_BADGE: Record<Score, string> = {
  hot: 'bg-[var(--score-hot-bg)] text-[var(--score-hot-fg)]',
  warm: 'bg-[var(--score-warm-bg)] text-[var(--score-warm-fg)]',
  cold: 'bg-[var(--score-cold-bg)] text-[var(--score-cold-fg)] border border-[var(--score-cold-border)]',
}

const STATUS_BADGE: Record<LeadStatus, string> = {
  new: 'bg-secondary text-secondary-foreground',
  contacted: 'bg-secondary text-secondary-foreground',
  converted: 'bg-primary text-primary-foreground',
}

const FILTERS = ['all', 'hot', 'warm', 'cold', 'contacted', 'converted'] as const

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const session = await auth()
  const { filter } = await searchParams
  const userId = session!.user.id

  const [
    { count: total },
    { count: hotCount },
    { count: contactedCount },
    { count: wonCount },
  ] = await Promise.all([
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
      .eq('status', 'sent'),
    supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'replied'),
  ])

  let query = supabaseAdmin
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (filter === 'hot' || filter === 'warm' || filter === 'cold') {
    query = query.eq('score', filter)
  } else if (filter === 'contacted') {
    query = query.eq('status', 'sent')
  } else if (filter === 'converted') {
    query = query.eq('status', 'replied')
  }

  const { data: leads } = await query

  const activeFilter = filter ?? 'all'

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Stat cards — clicking one sets the active filter */}
      <div className="grid grid-cols-4 gap-3 mb-6 animate-stagger-1">
        {([
          { href: '/dashboard', filterKey: 'all', count: total ?? 0, label: 'Total' },
          { href: '/dashboard?filter=hot', filterKey: 'hot', count: hotCount ?? 0, label: 'Hot' },
          { href: '/dashboard?filter=contacted', filterKey: 'contacted', count: contactedCount ?? 0, label: 'Contacted' },
          { href: '/dashboard?filter=converted', filterKey: 'converted', count: wonCount ?? 0, label: 'Won' },
        ] as const).map(({ href, filterKey, count, label }) => {
          const active = activeFilter === filterKey
          return (
            <Link
              key={filterKey}
              href={href}
              className={cn(
                'rounded-2xl p-5 transition-all',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border hover:bg-secondary'
              )}
            >
              <div className={cn(
                'text-3xl font-sans font-semibold mb-1 tabular-nums tracking-tight',
                active ? '' : 'text-foreground'
              )}>
                {count}
              </div>
              <div className={cn(
                'text-xs font-mono uppercase tracking-[0.08em]',
                active ? 'opacity-70' : 'text-muted-foreground'
              )}>
                {label}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Filter bar — for score-based filters not covered by stat cards */}
      <div className="flex gap-1.5 mb-5 flex-wrap animate-stagger-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === 'all' ? '/dashboard' : `/dashboard?filter=${f}`}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize',
              activeFilter === f
                ? 'bg-primary text-primary-foreground'
                : 'border border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
          >
            {f}
          </Link>
        ))}
      </div>

      {/* Leads table */}
      {!leads?.length ? (
        <div className="text-center py-16 text-muted-foreground animate-stagger-3">
          <p className="mb-4 text-sm">
            No leads yet{filter && filter !== 'all' ? ` matching "${filter}"` : ''}.
          </p>
          <Link href="/search" className={buttonVariants()}>
            Search for leads
          </Link>
        </div>
      ) : (
        <div className="animate-stagger-3 rounded-2xl border border-border overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_2fr_100px_100px] px-4 py-2.5 border-b border-border bg-secondary/40">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-[0.08em]">Business</div>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-[0.08em]">Location</div>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-[0.08em]">Score</div>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-[0.08em]">Status</div>
          </div>
          {leads.map((lead: Lead, i: number) => (
            <Link
              key={lead.id}
              href={`/leads/${lead.id}`}
              className={cn(
                'grid grid-cols-[2fr_2fr_100px_100px] px-4 py-3 items-center hover:bg-secondary transition-colors',
                i !== leads.length - 1 && 'border-b border-border'
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                  {initials(lead.name)}
                </div>
                <span className="font-medium text-foreground truncate">{lead.name}</span>
              </div>
              <div className="text-sm text-muted-foreground truncate pr-4">{lead.address}</div>
              <div>
                {lead.score ? (
                  <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', SCORE_BADGE[lead.score])}>
                    {lead.score}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/50">—</span>
                )}
              </div>
              <div>
                <span className={cn('text-xs px-2.5 py-1 rounded-full', STATUS_BADGE[lead.status])}>
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
