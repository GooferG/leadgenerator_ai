import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

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

  // Verify ownership before updating
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!lead || lead.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const update: Record<string, string> = {}
  if (body.status !== undefined) update.status = body.status
  if (body.notes !== undefined) update.notes = body.notes

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
