import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { hasValidServiceKey } from '@/lib/auth-service'
import { MockupInputSchema, type MockupProps } from '@/lib/schemas'
import { generateSlug } from '@/lib/slug'

// Create a published mockup for a lead.
// Auth: approved session OR x-hook-service-key.
// Behavior:
//   1. Validate input
//   2. If `props` not provided, derive from lead.latest enrichment + lead row
//   3. Generate a unique slug (retry up to 3 times on collision)
//   4. Insert into `mockups` with `published_at = now()`
//   5. Bump `lead.status = 'mockup_ready'`
//   6. Return { id, slug, public_url }

const SLUG_RETRIES = 3

export async function POST(req: Request) {
  const session = await auth()
  const sessionOk = !!session?.user?.approved
  const serviceOk = hasValidServiceKey(req)

  if (!sessionOk && !serviceOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = MockupInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const input = parsed.data

  // Resolve props — either provided or derived from the lead's latest enrichment.
  let props: MockupProps
  if (input.props) {
    props = input.props
  } else {
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('leads')
      .select('business_name, name, business_address, address, business_phone, phone, enrichments(site_brief)')
      .eq('id', input.lead_id)
      .order('created_at', { foreignTable: 'enrichments', ascending: false })
      .limit(1, { foreignTable: 'enrichments' })
      .single()

    if (leadErr || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const enrichment = Array.isArray(lead.enrichments) ? lead.enrichments[0] : lead.enrichments
    const siteBrief = enrichment?.site_brief as Record<string, unknown> | undefined
    if (!siteBrief) {
      return NextResponse.json(
        { error: 'Lead has no enrichment yet — cannot derive mockup props' },
        { status: 400 }
      )
    }

    props = {
      business_name: (lead.business_name ?? lead.name ?? 'Business') as string,
      business_address: (lead.business_address ?? lead.address ?? null) as string | null,
      business_phone: (lead.business_phone ?? lead.phone ?? null) as string | null,
      hero_angle: (siteBrief.hero_angle as string) ?? '',
      services: (siteBrief.services as string[]) ?? [],
      tone: (siteBrief.tone as string) ?? '',
      palette: (siteBrief.palette as string) ?? '',
      cta_copy: (siteBrief.cta_copy as string) ?? 'Get a free estimate',
      design_choice: (siteBrief.design_choice as string) ?? '',
    }
  }

  // Insert with retries on slug collision.
  let lastError: unknown = null
  for (let attempt = 0; attempt < SLUG_RETRIES; attempt++) {
    const slug = generateSlug()
    const { data, error } = await supabaseAdmin
      .from('mockups')
      .insert({
        lead_id: input.lead_id,
        slug,
        template_id: input.template_id,
        props,
        published_at: new Date().toISOString(),
      })
      .select('id, slug')
      .single()

    if (!error && data) {
      // Bump lead status; non-fatal on failure (mockup is still published)
      const { error: bumpErr } = await supabaseAdmin
        .from('leads')
        .update({ status: 'mockup_ready' })
        .eq('id', input.lead_id)
      if (bumpErr) console.error('Lead status bump error:', bumpErr)

      const publicBase = process.env.HOOK_PUBLIC_BASE_URL ?? new URL(req.url).origin
      return NextResponse.json(
        {
          id: data.id,
          slug: data.slug,
          public_url: `${publicBase}/m/${data.slug}`,
        },
        { status: 201 }
      )
    }

    lastError = error
    // 23505 = unique violation; retry with a fresh slug. Anything else fails fast.
    if (error?.code !== '23505') break
  }

  console.error('Mockup insert error:', lastError)
  return NextResponse.json({ error: 'Mockup insert failed' }, { status: 500 })
}
