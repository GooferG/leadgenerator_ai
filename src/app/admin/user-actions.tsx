'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type UserState = 'pending' | 'approved' | 'rejected'

export function UserActions({
  userId,
  userState,
}: {
  userId: string
  userState: UserState
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAction(action: 'approve' | 'reject' | 'revoke') {
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })

    setLoading(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }))
      setError(body.error ?? 'Action failed')
      return
    }

    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      {userState === 'pending' && (
        <>
          <button
            onClick={() => handleAction('approve')}
            disabled={loading}
            className="text-xs px-3 py-1 rounded-md bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 disabled:opacity-50 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => handleAction('reject')}
            disabled={loading}
            className="text-xs px-3 py-1 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-red-900/40 hover:text-red-400 hover:border-red-900/50 disabled:opacity-50 transition-colors"
          >
            Reject
          </button>
        </>
      )}

      {userState === 'approved' && (
        <button
          onClick={() => handleAction('revoke')}
          disabled={loading}
          className="text-xs px-3 py-1 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-amber-900/40 hover:text-amber-400 hover:border-amber-900/50 disabled:opacity-50 transition-colors"
        >
          Revoke
        </button>
      )}

      {userState === 'rejected' && (
        <button
          onClick={() => handleAction('approve')}
          disabled={loading}
          className="text-xs px-3 py-1 rounded-md bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 disabled:opacity-50 transition-colors"
        >
          Approve
        </button>
      )}

      {loading && (
        <span className="text-xs text-zinc-600">Saving…</span>
      )}
      {error && (
        <span className="text-xs text-red-400">{error}</span>
      )}
    </div>
  )
}
