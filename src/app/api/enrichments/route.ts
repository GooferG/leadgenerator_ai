import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { hasValidServiceKey } from '@/lib/auth-service'
import { EnrichmentInputSchema } from '@/lib/schemas'

// Create an enrichment record for a lead, mirror CRM fields to the leads row,
// and bump lead.status accordingly.
//
// Auth: approved session OR x-hook-service-key.
//
// Side effects:
//   1. Insert into `enrichments` (always)
//   2. Mirror score/score_label/reasoning/pitch/site_audit/scrape_error to
//      leads.* if provided — keeps the dashboard's CRM view populated for
//      skill-driven leads
//   3. If chain_flag_reason set: lead.status='archived', is_chain=true
//      Otherwise: lead.status='enriched'
//
// On --force re-enrichment: existing enrichment rows aren't deleted; the new
// one is inserted alongside (the lead detail page picks the most recent via
// ordering). This preserves audit history of what Claude said over time.
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

  // Build the leads update: status + is_chain + any provided CRM fields.
  const leadUpdate: Record<string, unknown> = isChain
    ? { status: 'archived', is_chain: true }
    : { status: 'enriched' }

  if (input.score !== undefined) leadUpdate.score = input.score
  if (input.score_label !== undefined) leadUpdate.score_label = input.score_label
  if (input.reasoning !== undefined) leadUpdate.reasoning = input.reasoning
  if (input.pitch !== undefined) leadUpdate.pitch = input.pitch
  if (input.site_audit !== undefined) leadUpdate.site_audit = input.site_audit
  if (input.scrape_error !== undefined) leadUpdate.scrape_error = input.scrape_error

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
