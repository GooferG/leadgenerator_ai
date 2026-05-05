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
    <div className="bg-card border border-border rounded-2xl p-4">
      <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-[0.08em] mb-3 flex items-center gap-2">
        Pipeline
        {saving && (
          <span className="text-xs font-normal text-muted-foreground/60">Saving…</span>
        )}
      </h2>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm text-muted-foreground block mb-1.5">Status</label>
          <select
            value={status}
            onChange={async (e) => {
              const newStatus = e.target.value as LeadStatus
              setStatus(newStatus)
              await updateLead({ status: newStatus })
            }}
            className="bg-background border border-border rounded-full px-4 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
          >
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="converted">Converted</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground block mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => updateLead({ notes })}
            placeholder="Add notes about this lead…"
            rows={4}
            className="bg-background border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 w-full focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors resize-none"
          />
        </div>
        <div className="pt-2 border-t border-border">
          <button
            onClick={deleteLead}
            disabled={deleting}
            className="text-xs text-muted-foreground/60 hover:text-destructive transition-colors disabled:opacity-50"
          >
            {deleting ? 'Removing…' : 'Remove lead'}
          </button>
        </div>
      </div>
    </div>
  )
}
