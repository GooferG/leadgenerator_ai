import { z } from 'zod'

// Pipeline status values per Phase 1 schema (migration 004).
export const LeadStatusSchema = z.enum([
  'discovered',
  'enriched',
  'mockup_ready',
  'video_ready',
  'sent',
  'replied',
  'archived',
])
export type LeadStatusValue = z.infer<typeof LeadStatusSchema>

// Shape posted by the discover skill to /api/leads/bulk.
// Matches the column shape added by migration 004; legacy `name`/`address`/`phone`
// are mirrored from `business_*` server-side so existing UI keeps working.
export const LeadInputSchema = z.object({
  place_id: z.string().min(1),
  business_name: z.string().min(1),
  business_address: z.string().optional().nullable(),
  business_phone: z.string().optional().nullable(),
  website_url: z.string().optional().nullable(),
  niche: z.string().min(1),
  area_label: z.string().min(1),
  area_lat: z.number().optional().nullable(),
  area_lng: z.number().optional().nullable(),
  rating: z.number().optional().nullable(),
  review_count: z.number().int().optional().nullable(),
  maps_url: z.string().optional().nullable(),
  place_data: z.unknown().optional(),
})
export type LeadInput = z.infer<typeof LeadInputSchema>

export const BulkLeadsInputSchema = z.object({
  leads: z.array(LeadInputSchema).min(1),
})

// Shape of the structured site_brief jsonb returned by the enrichment skill.
// Loose for now — Phase 1.5 will tighten once Claude's output stabilizes.
export const SiteBriefSchema = z.object({
  hero_angle: z.string(),
  services: z.array(z.string()),
  tone: z.string(),
  palette: z.string(),
  cta_copy: z.string(),
  design_choice: z.string(),
}).partial()

export const EnrichmentInputSchema = z.object({
  lead_id: z.string().uuid(),
  diagnosis: z.string(),
  site_brief: SiteBriefSchema,
  cold_message: z.string(),
  chain_flag_reason: z.string().optional().nullable(),
  model_version: z.string(),
})
export type EnrichmentInput = z.infer<typeof EnrichmentInputSchema>

// Query params for GET /api/leads (Phase 1 list endpoint).
export const LeadsListQuerySchema = z.object({
  status: LeadStatusSchema.optional(),
  niche: z.string().optional(),
  area_label: z.string().optional(),
  owner_id: z.string().uuid().optional(),
  scope: z.enum(['mine', 'all']).default('mine'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
