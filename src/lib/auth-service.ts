// Service-key auth for skill / out-of-browser callers (e.g. discover skill).
// Used alongside the regular session check so write endpoints accept either:
//   - a logged-in approved user (session)
//   - a valid x-hook-service-key header (skill / cron / external script)
//
// Read endpoints stay session-only; service-key is write-only.

export function hasValidServiceKey(req: Request): boolean {
  const expected = process.env.HOOK_SERVICE_API_KEY
  if (!expected) return false
  const provided = req.headers.get('x-hook-service-key')
  return !!provided && provided === expected
}

// The user_id assigned to leads/enrichments inserted by service-key callers.
// Set via HOOK_SERVICE_OWNER_ID env var (admin user's UUID).
export function getServiceOwnerId(): string {
  const id = process.env.HOOK_SERVICE_OWNER_ID
  if (!id) {
    throw new Error('HOOK_SERVICE_OWNER_ID not set')
  }
  return id
}
