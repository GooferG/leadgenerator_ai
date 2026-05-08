import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { hasValidServiceKey } from '@/lib/auth-service'
import { VideoInputSchema } from '@/lib/schemas'

// Record video walkthrough metadata for a lead and bump lead.status='video_ready'.
// The actual file is uploaded to Supabase Storage by the video skill before this
// endpoint is called — we just persist the row and link it to lead/mockup.
//
// Auth: approved session OR x-hook-service-key.
export async function POST(req: Request) {
  const session = await auth()
  const sessionOk = !!session?.user?.approved
  const serviceOk = hasValidServiceKey(req)

  if (!sessionOk && !serviceOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = VideoInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const input = parsed.data

  // Resolve mockup_id from the lead if not provided — picks the most recent published mockup.
  let mockupId = input.mockup_id ?? null
  if (!mockupId) {
    const { data: latestMockup } = await supabaseAdmin
      .from('mockups')
      .select('id')
      .eq('lead_id', input.lead_id)
      .not('published_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    mockupId = latestMockup?.id ?? null
  }

  const { data: video, error: insertError } = await supabaseAdmin
    .from('videos')
    .insert({
      lead_id: input.lead_id,
      mockup_id: mockupId,
      storage_path: input.storage_path,
      public_url: input.public_url,
      duration_seconds: input.duration_seconds,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('Video insert error:', insertError)
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
  }

  const { error: bumpError } = await supabaseAdmin
    .from('leads')
    .update({ status: 'video_ready' })
    .eq('id', input.lead_id)

  if (bumpError) {
    console.error('Lead status bump error:', bumpError)
    return NextResponse.json(
      { id: video.id, warning: 'Lead status not updated' },
      { status: 201 }
    )
  }

  return NextResponse.json({ id: video.id }, { status: 201 })
}
