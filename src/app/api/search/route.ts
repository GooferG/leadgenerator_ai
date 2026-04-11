import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { searchPlaces } from '@/lib/places'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.approved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { businessType, location } = await req.json()

  if (!businessType?.trim() || !location?.trim()) {
    return NextResponse.json(
      { error: 'businessType and location are required' },
      { status: 400 }
    )
  }

  try {
    const results = await searchPlaces(businessType.trim(), location.trim())
    return NextResponse.json(results)
  } catch (err) {
    console.error('Places search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
