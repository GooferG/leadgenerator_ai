'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LeadStatus } from '@/types/lead'

export function LeadActions({
  leadId,
  status: initialStatus,
  notes: initialNotes,
}: {
  leadId: string
  status: LeadStatus
  notes: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState<LeadStatus>(initialStatus)
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function updateLead(update: { status?: LeadStatus; notes?: string }) {
    setSaving(true)
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    setSaving(false)
  }

  async function deleteLead() {
    if (!confirm('Remove this lead? This cannot be undone.')) return
    setDeleting(true)
    await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
    router.push('/dashboard')
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        Pipeline
        {saving && (
          <span className="text-xs font-normal text-zinc-600">Saving…</span>
        )}
      </h2>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm text-zinc-400 block mb-1.5">Status</label>
          <select
            value={status}
            onChange={async (e) => {
              const newStatus = e.target.value as LeadStatus
              setStatus(newStatus)
              await updateLead({ status: newStatus })
            }}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors"
          >
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="converted">Converted</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-zinc-400 block mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => updateLead({ notes })}
            placeholder="Add notes about this lead…"
            rows={4}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors resize-none"
          />
        </div>
        <div className="pt-2 border-t border-zinc-800">
          <button
            onClick={deleteLead}
            disabled={deleting}
            className="text-xs text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {deleting ? 'Removing…' : 'Remove lead'}
          </button>
        </div>
      </div>
    </div>
  )
}
