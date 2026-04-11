import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.approved || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { action } = await req.json()

  if (!['approve', 'reject', 'revoke'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  // Prevent admin from modifying their own account
  if (id === session.user.id) {
    return NextResponse.json(
      { error: 'Cannot modify your own account' },
      { status: 400 }
    )
  }

  // Prevent modifying another admin
  const { data: target } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', id)
    .single()

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (target.role === 'admin') {
    return NextResponse.json(
      { error: 'Cannot modify an admin account' },
      { status: 400 }
    )
  }

  const updates: { approved: boolean; role: string } =
    action === 'approve'
      ? { approved: true, role: 'user' }
      : action === 'reject'
      ? { approved: false, role: 'rejected' }
      : { approved: false, role: 'user' } // revoke

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json(data)
}
