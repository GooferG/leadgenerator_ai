'use client'

import { useState } from 'react'
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
  const [status, setStatus] = useState<LeadStatus>(initialStatus)
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)

  async function updateLead(update: { status?: LeadStatus; notes?: string }) {
    setSaving(true)
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    setSaving(false)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        Pipeline
        {saving && <span className="text-xs font-normal text-slate-400">Saving…</span>}
      </h2>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm text-slate-600 block mb-1">Status</label>
          <select
            value={status}
            onChange={async (e) => {
              const newStatus = e.target.value as LeadStatus
              setStatus(newStatus)
              await updateLead({ status: newStatus })
            }}
            className="border border-slate-200 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="converted">Converted</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-600 block mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => updateLead({ notes })}
            placeholder="Add notes about this lead…"
            rows={4}
            className="border border-slate-200 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>
      </div>
    </div>
  )
}
