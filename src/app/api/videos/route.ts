import { NextResponse } from 'next/server'

// Stub for Phase 3 (Playwright video walkthroughs). Route shape exists so future
// skill calls fail with a clear message rather than 404.
export async function POST() {
  return NextResponse.json(
    { error: 'Phase 3 (videos) not yet built' },
    { status: 501 }
  )
}
