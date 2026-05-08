// Upload a local MP4 to Supabase Storage `mockup-videos` bucket.
// Uses the service-role key directly — this is the only place in the skill
// world where we touch Supabase outside of Hook's API. Reason: piping a
// 5MB binary through the Hook API would mean a serverless function with
// large memory + slow upload, while the Supabase JS client streams natively.

import { createClient } from '@supabase/supabase-js'
import { readFile, unlink } from 'node:fs/promises'
import { basename } from 'node:path'

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'mockup-videos'

interface UploadOpts {
  mp4Path: string
  storageKey: string // e.g. `roofer/<lead-slug>-<timestamp>.mp4`
  cleanup?: boolean
}

export async function uploadMp4(opts: UploadOpts): Promise<{
  storage_path: string
  public_url: string
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set')
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')

  const client = createClient(supabaseUrl, serviceKey)
  const buffer = await readFile(opts.mp4Path)

  const { error } = await client.storage
    .from(BUCKET)
    .upload(opts.storageKey, buffer, {
      contentType: 'video/mp4',
      cacheControl: '3600',
      upsert: true,
    })

  if (error) {
    throw new Error(`Supabase upload error: ${error.message}`)
  }

  const { data: pub } = client.storage.from(BUCKET).getPublicUrl(opts.storageKey)

  if (opts.cleanup !== false) {
    await unlink(opts.mp4Path).catch(() => {})
  }

  return {
    storage_path: `${BUCKET}/${opts.storageKey}`,
    public_url: pub.publicUrl,
  }
}

// Slugify a string into a filesystem/storage-safe key fragment.
export function slugifyForStorage(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function buildStorageKey(opts: { niche?: string | null; businessName: string }): string {
  const niche = opts.niche ? slugifyForStorage(opts.niche) : 'misc'
  const name = slugifyForStorage(opts.businessName)
  const suffix = `${name}-${Date.now()}`
  // Bucket-relative path
  return `${niche}/${suffix}.mp4`
}

// Use basename to ensure storage keys never include directory traversal
export function safeFilename(s: string): string {
  return basename(s)
}
