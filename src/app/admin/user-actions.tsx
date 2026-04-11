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
            className="text-xs px-3 py-1 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => handleAction('reject')}
            disabled={loading}
            className="text-xs px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            Reject
          </button>
        </>
      )}

      {userState === 'approved' && (
        <button
          onClick={() => handleAction('revoke')}
          disabled={loading}
          className="text-xs px-3 py-1 rounded-md bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          Revoke
        </button>
      )}

      {userState === 'rejected' && (
        <button
          onClick={() => handleAction('approve')}
          disabled={loading}
          className="text-xs px-3 py-1 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          Approve
        </button>
      )}

      {loading && (
        <span className="text-xs text-slate-400">Saving…</span>
      )}
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </div>
  )
}
