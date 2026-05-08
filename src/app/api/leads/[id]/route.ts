import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { hasValidServiceKey } from '@/lib/auth-service'

async function getOwnedLead(id: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('leads')
    .select('user_id')
    .eq('id', id)
    .single()
  return data?.user_id === userId ? data : null
}

// Single lead with related enrichment, mockup, video, and outreach history.
// Auth: approved session OR x-hook-service-key. Service-key callers (skills)
// bypass the per-user filter since they operate on the shared workspace.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const sessionOk = !!session?.user?.approved
  const serviceOk = hasValidServiceKey(req)

  if (!sessionOk && !serviceOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let query = supabaseAdmin
    .from('leads')
    .select('*, enrichments(*), mockups(*), videos(*), outreach_messages(*)')
    .eq('id', id)

  // Session callers stay scoped to their own leads to preserve existing
  // dashboard behavior. Service-key callers see any lead in the workspace.
  if (sessionOk && !serviceOk) {
    query = query.eq('user_id', session!.user.id)
  }

  const { data, error } = await query.single()

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
