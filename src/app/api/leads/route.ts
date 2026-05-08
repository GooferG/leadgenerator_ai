import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { hasValidServiceKey } from '@/lib/auth-service'
import { LeadsListQuerySchema } from '@/lib/schemas'

// List leads.
// Default scope='mine' preserves existing behavior (per-user isolation).
// scope='all' returns shared workspace leads — used by the future Phase 4 dashboard
// and the discover/enrich skill-facing read paths. Each lead includes its latest
// enrichment when one exists.
//
// Auth: approved session OR x-hook-service-key. Service-key callers must pass
// scope='all' (no implicit `user_id` to filter by).
export async function GET(req: Request) {
  const session = await auth()
  const sessionOk = !!session?.user?.approved
  const serviceOk = hasValidServiceKey(req)

  if (!sessionOk && !serviceOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const parsed = LeadsListQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries())
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { status, niche, area_label, owner_id, limit, offset } = parsed.data
  // Service-key callers default to scope='all' since they have no session user.
  const scope = !sessionOk && parsed.data.scope === 'mine' ? 'all' : parsed.data.scope

  let query = supabaseAdmin
    .from('leads')
    .select('*, enrichments(*), mockups(*), videos(*)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (scope === 'mine') {
    query = query.eq('user_id', session!.user.id)
  } else if (owner_id) {
    query = query.eq('user_id', owner_id)
  }

  if (status) query = query.eq('status', status)
  if (niche) query = query.eq('niche', niche)
  if (area_label) query = query.eq('area_label', area_label)

  const { data, error } = await query

  if (error) {
    console.error('List leads error:', error)
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// Single-lead create (legacy path, used by the search UI's "Save" button).
// Kept untouched for backwards compatibility — bulk inserts go through /api/leads/bulk.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.approved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  const { data, error } = await supabaseAdmin
    .from('leads')
    .insert({
      user_id: session.user.id,
      place_id: body.placeId ?? null,
      name: body.name,
      business_name: body.name,
      address: body.address ?? null,
      business_address: body.address ?? null,
      phone: body.phone ?? null,
      business_phone: body.phone ?? null,
      website: body.website ?? null,
      score: body.score ?? null,
      score_label: body.scoreLabel ?? null,
      reasoning: body.reasoning ?? null,
      pitch: body.pitch ?? null,
      maps_url: body.mapsUrl ?? null,
      status: 'discovered',
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already saved' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
