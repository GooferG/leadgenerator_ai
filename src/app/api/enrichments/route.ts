import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { hasValidServiceKey } from '@/lib/auth-service'
import { EnrichmentInputSchema } from '@/lib/schemas'

// Create an enrichment record for a lead and bump lead.status accordingly.
// Auth: approved session OR x-hook-service-key (the Phase 1.5 enrichment skill
// will call this with the service key).
//
// Side effect: if chain_flag_reason is set the lead is archived as a chain;
// otherwise its status moves to 'enriched'.
export async function POST(req: Request) {
  const session = await auth()
  const sessionOk = !!session?.user?.approved
  const serviceOk = hasValidServiceKey(req)

  if (!sessionOk && !serviceOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = EnrichmentInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const input = parsed.data

  const { data: enrichment, error: insertError } = await supabaseAdmin
    .from('enrichments')
    .insert({
      lead_id: input.lead_id,
      diagnosis: input.diagnosis,
      site_brief: input.site_brief,
      cold_message: input.cold_message,
      chain_flag_reason: input.chain_flag_reason ?? null,
      model_version: input.model_version,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('Enrichment insert error:', insertError)
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
  }

  const isChain = !!input.chain_flag_reason
  const leadUpdate = isChain
    ? { status: 'archived', is_chain: true }
    : { status: 'enriched' }

  const { error: updateError } = await supabaseAdmin
    .from('leads')
    .update(leadUpdate)
    .eq('id', input.lead_id)

  if (updateError) {
    console.error('Lead status bump error:', updateError)
    // Enrichment row is in; surface a warning but don't fail the request
    return NextResponse.json(
      { id: enrichment.id, warning: 'Lead status not updated' },
      { status: 201 }
    )
  }

  return NextResponse.json({ id: enrichment.id }, { status: 201 })
}
