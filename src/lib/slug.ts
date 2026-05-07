// Short, URL-safe random slug for public mockup URLs.
// Crockford-style base32 (no I/L/O/U) for readability when read aloud.
// 7 chars × 32 alphabet = ~3.4e10 possibilities — collision risk on the order
// of 1 in 30,000 at 1M slugs. Fine for v1; we retry on the unique constraint
// at the API layer if we ever hit a collision.

import { randomBytes } from 'node:crypto'

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz' // Crockford base32 (no i/l/o/u)

export function generateSlug(length = 7): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return out
}
