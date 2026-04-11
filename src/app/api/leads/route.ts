import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const session = await auth()
  if (!session?.user?.approved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }

  return NextResponse.json(data)
}

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
      address: body.address ?? null,
      phone: body.phone ?? null,
      website: body.website ?? null,
      score: body.score ?? null,
      score_label: body.scoreLabel ?? null,
      reasoning: body.reasoning ?? null,
      pitch: body.pitch ?? null,
      maps_url: body.mapsUrl ?? null,
      status: 'new',
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
