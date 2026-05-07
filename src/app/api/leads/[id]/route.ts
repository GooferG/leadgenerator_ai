import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

async function getOwnedLead(id: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('leads')
    .select('user_id')
    .eq('id', id)
    .single()
  return data?.user_id === userId ? data : null
}

// Single lead with related enrichment, mockup, video, and outreach history.
// Auth: session. Currently scopes to lead.user_id == session.user.id; the shared-workspace
// read path will land in Phase 4 alongside the dashboard redesign.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.approved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('*, enrichments(*), mockups(*), videos(*), outreach_messages(*)')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.approved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  if (!(await getOwnedLead(id, session.user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const update: Record<string, unknown> = {}
  // Pipeline fields
  if (body.status !== undefined) update.status = body.status
  if (body.is_chain !== undefined) update.is_chain = body.is_chain
  if (body.notes !== undefined) update.notes = body.notes
  // Score fields — written back when a saved lead gets scored in the search UI
  if (body.score !== undefined) update.score = body.score
  if (body.score_label !== undefined) update.score_label = body.score_label
  if (body.reasoning !== undefined) update.reasoning = body.reasoning
  if (body.pitch !== undefined) update.pitch = body.pitch
  if (body.site_audit !== undefined) update.site_audit = body.site_audit
  if (body.scrape_error !== undefined) update.scrape_error = body.scrape_error
  // Discovery / area metadata
  if (body.business_name !== undefined) update.business_name = body.business_name
  if (body.business_address !== undefined) update.business_address = body.business_address
  if (body.business_phone !== undefined) update.business_phone = body.business_phone
  if (body.niche !== undefined) update.niche = body.niche
  if (body.area_label !== undefined) update.area_label = body.area_label

  const { data, error } = await supabaseAdmin
    .from('leads')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.approved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  if (!(await getOwnedLead(id, session.user.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabaseAdmin
    .from('leads')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
