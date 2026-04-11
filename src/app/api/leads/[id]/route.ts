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

  const update: Record<string, string | null> = {}
  if (body.status !== undefined) update.status = body.status
  if (body.notes !== undefined) update.notes = body.notes
  // Score fields — written back when a saved lead gets scored in the search UI
  if (body.score !== undefined) update.score = body.score
  if (body.score_label !== undefined) update.score_label = body.score_label
  if (body.reasoning !== undefined) update.reasoning = body.reasoning
  if (body.pitch !== undefined) update.pitch = body.pitch

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
