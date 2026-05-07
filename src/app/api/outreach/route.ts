import { NextResponse } from 'next/server'

// Stub for Phase 4 (Resend outreach + follow-ups). Route shape exists so future
// skill calls fail with a clear message rather than 404.
export async function POST() {
  return NextResponse.json(
    { error: 'Phase 4 (outreach) not yet built' },
    { status: 501 }
  )
}
