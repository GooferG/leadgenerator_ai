import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { hasValidServiceKey, getServiceOwnerId } from '@/lib/auth-service'
import { BulkLeadsInputSchema } from '@/lib/schemas'

// Bulk-insert leads from the discover skill.
// Auth: approved session OR x-hook-service-key.
// Dedupe: ON CONFLICT (place_id) DO NOTHING — global uniqueness per migration 004.
export async function POST(req: Request) {
  const session = await auth()
  const sessionOk = !!session?.user?.approved
  const serviceOk = hasValidServiceKey(req)

  if (!sessionOk && !serviceOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = BulkLeadsInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const ownerId = sessionOk ? session!.user.id : getServiceOwnerId()

  // Map skill output -> table columns. Mirror business_* into legacy name/address/phone
  // so existing UI keeps rendering until the Phase 4 redesign drops the duplicates.
  const rows = parsed.data.leads.map((l) => ({
    user_id: ownerId,
    place_id: l.place_id,
    name: l.business_name,
    business_name: l.business_name,
    address: l.business_address ?? null,
    business_address: l.business_address ?? null,
    phone: l.business_phone ?? null,
    business_phone: l.business_phone ?? null,
    website: l.website_url ?? null,
    niche: l.niche,
    area_label: l.area_label,
    area_lat: l.area_lat ?? null,
    area_lng: l.area_lng ?? null,
    maps_url: l.maps_url ?? null,
    place_data: l.place_data ?? null,
    status: 'discovered',
  }))

  // Upsert with ignoreDuplicates so the unique index on place_id silently skips existing rows.
  const { data, error } = await supabaseAdmin
    .from('leads')
    .upsert(rows, { onConflict: 'place_id', ignoreDuplicates: true })
    .select('id')

  if (error) {
    console.error('Bulk insert error:', error)
    return NextResponse.json({ error: 'Bulk insert failed' }, { status: 500 })
  }

  const inserted = data?.length ?? 0
  const skipped = rows.length - inserted

  return NextResponse.json({
    inserted,
    skipped,
    lead_ids: data?.map((r) => r.id) ?? [],
  })
}
