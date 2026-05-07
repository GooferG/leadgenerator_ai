import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { LocalServiceTemplate } from './templates/local-service'
import type { MockupProps } from '@/lib/schemas'

// Public mockup page. No auth — the URL itself is the access control.
// Renders 404 for unpublished or unknown slugs.

interface PageParams {
  params: Promise<{ slug: string }>
}

async function getPublishedMockup(slug: string) {
  const { data, error } = await supabaseAdmin
    .from('mockups')
    .select('id, slug, template_id, props, published_at')
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .single()

  if (error || !data) return null
  return data
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params
  const mockup = await getPublishedMockup(slug)
  if (!mockup) return { title: 'Not found' }
  const props = mockup.props as MockupProps
  return {
    title: props.business_name,
    description: props.hero_angle || `${props.business_name} — local service`,
    robots: { index: false, follow: false }, // mockups should not be indexed
  }
}

export default async function MockupPage({ params }: PageParams) {
  const { slug } = await params
  const mockup = await getPublishedMockup(slug)
  if (!mockup) notFound()

  const props = mockup.props as MockupProps

  // template_id reserved for Tier 3; v1 always renders local-service.
  return <LocalServiceTemplate props={props} />
}
