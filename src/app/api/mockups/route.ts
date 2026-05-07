import { NextResponse } from 'next/server'

// Stub for Phase 2 (templated mockup pages). Route shape exists so future
// skill calls fail with a clear message rather than 404.
export async function POST() {
  return NextResponse.json(
    { error: 'Phase 2 (mockups) not yet built' },
    { status: 501 }
  )
}
