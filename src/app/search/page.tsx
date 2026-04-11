import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { SearchClient } from './search-client'

// Server Component: fetches the user's saved placeIds so the client
// knows which results are already in their pipeline on page load.
export default async function SearchPage() {
  const session = await auth()

  const { data: savedLeads } = await supabaseAdmin
    .from('leads')
    .select('place_id')
    .eq('user_id', session!.user.id)
    .not('place_id', 'is', null)

  const savedPlaceIds = savedLeads?.map((l) => l.place_id as string) ?? []

  return <SearchClient initialSavedPlaceIds={savedPlaceIds} />
}
