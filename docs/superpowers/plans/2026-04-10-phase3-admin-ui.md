# Lead Generator Phase 3: Admin User Approval UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin placeholder with a full user management UI that lets the admin approve, reject, and revoke access for any user.

**Architecture:** A Supabase migration extends the `role` check constraint to allow `'rejected'`. A single API route handles all three actions (approve/reject/revoke). The admin page is a Server Component that fetches all users and groups them; a `UserActions` Client Component handles button clicks, calls the API, and refreshes the page.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind, Supabase, NextAuth v5

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/003_add_rejected_role.sql` | Create | Extend role check constraint to allow 'rejected' |
| `src/app/api/admin/users/[id]/route.ts` | Create | PATCH — approve/reject/revoke (admin only) |
| `src/app/admin/user-actions.tsx` | Create | Client Component — action buttons + optimistic UI |
| `src/app/admin/page.tsx` | Replace | Server Component — fetch all users, render sections |

---

## Task 1: Supabase migration — add 'rejected' role

**Files:**
- Create: `supabase/migrations/003_add_rejected_role.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/003_add_rejected_role.sql`:

```sql
-- Extend the role check constraint to allow 'rejected' as a valid value.
-- We drop the old constraint and add a new one that includes 'rejected'.
alter table users
  drop constraint if exists users_role_check;

alter table users
  add constraint users_role_check
  check (role in ('user', 'admin', 'rejected'));
```

- [ ] **Step 2: Apply the migration in Supabase**

1. Go to your Supabase project → **SQL Editor → New query**
2. Paste the contents of `003_add_rejected_role.sql` and click **Run**
3. Expected: "Success. No rows returned"

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_add_rejected_role.sql
git commit -m "feat: extend role constraint to allow rejected status"
```

---

## Task 2: PATCH /api/admin/users/[id] route

**Files:**
- Create: `src/app/api/admin/users/[id]/route.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "src/app/api/admin/users/[id]"
```

- [ ] **Step 2: Create the route**

Create `src/app/api/admin/users/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.approved || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { action } = await req.json()

  if (!['approve', 'reject', 'revoke'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  // Prevent admin from modifying their own account
  if (id === session.user.id) {
    return NextResponse.json(
      { error: 'Cannot modify your own account' },
      { status: 400 }
    )
  }

  // Prevent modifying another admin
  const { data: target } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', id)
    .single()

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (target.role === 'admin') {
    return NextResponse.json(
      { error: 'Cannot modify an admin account' },
      { status: 400 }
    )
  }

  const updates: { approved: boolean; role: string } =
    action === 'approve'
      ? { approved: true, role: 'user' }
      : action === 'reject'
      ? { approved: false, role: 'rejected' }
      : { approved: false, role: 'user' } // revoke

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/admin/users/[id]/route.ts"
git commit -m "feat: add PATCH /api/admin/users/[id] route for approve/reject/revoke"
```

---

## Task 3: UserActions client component

**Files:**
- Create: `src/app/admin/user-actions.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/admin/user-actions.tsx`:

```typescript
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/user-actions.tsx
git commit -m "feat: add UserActions client component for admin approve/reject/revoke"
```

---

## Task 4: Admin page

**Files:**
- Replace: `src/app/admin/page.tsx`

- [ ] **Step 1: Replace the admin placeholder**

Replace the full contents of `src/app/admin/page.tsx`:

```typescript
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { UserActions } from './user-actions'

interface AppUser {
  id: string
  email: string
  name: string | null
  image: string | null
  approved: boolean
  role: string
  created_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function Avatar({ user }: { user: AppUser }) {
  if (user.image) {
    return (
      <img
        src={user.image}
        alt={user.name ?? user.email}
        className="w-8 h-8 rounded-full object-cover shrink-0"
      />
    )
  }
  const initials = (user.name ?? user.email)
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600 shrink-0">
      {initials}
    </div>
  )
}

function UserRow({
  user,
  userState,
  sessionUserId,
}: {
  user: AppUser
  userState: 'pending' | 'approved' | 'rejected'
  sessionUserId: string
}) {
  const isSelf = user.id === sessionUserId
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-white border border-slate-200 rounded-lg">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar user={user} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900 truncate">
            {user.name ?? '—'}
            {isSelf && (
              <span className="ml-2 text-xs text-slate-400 font-normal">You</span>
            )}
          </div>
          <div className="text-xs text-slate-500 truncate">{user.email}</div>
        </div>
      </div>
      <div className="flex items-center gap-4 ml-4 shrink-0">
        <span className="text-xs text-slate-400 hidden sm:block">
          {formatDate(user.created_at)}
        </span>
        {isSelf ? (
          <span className="text-xs text-slate-400 italic">No actions</span>
        ) : (
          <UserActions userId={user.id} userState={userState} />
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  users,
  userState,
  sessionUserId,
  emptyMessage,
}: {
  title: string
  users: AppUser[]
  userState: 'pending' | 'approved' | 'rejected'
  sessionUserId: string
  emptyMessage: string
}) {
  return (
    <div className="mb-8">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        {title} ({users.length})
      </h2>
      {users.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-lg">
          {emptyMessage}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              userState={userState}
              sessionUserId={sessionUserId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default async function AdminPage() {
  const session = await auth()

  const { data: allUsers } = await supabaseAdmin
    .from('users')
    .select('*')
    .neq('role', 'admin')
    .order('created_at', { ascending: false })

  const users = (allUsers ?? []) as AppUser[]

  const pending = users.filter((u) => !u.approved && u.role === 'user')
  const approved = users.filter((u) => u.approved && u.role === 'user')
  const rejected = users.filter((u) => u.role === 'rejected')

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">User Management</h1>
      <p className="text-sm text-slate-500 mb-8">
        Approve or reject access requests. Revoke access from existing users.
      </p>

      <Section
        title="Pending"
        users={pending}
        userState="pending"
        sessionUserId={session!.user.id}
        emptyMessage="No pending users"
      />
      <Section
        title="Approved"
        users={approved}
        userState="approved"
        sessionUserId={session!.user.id}
        emptyMessage="No approved users"
      />
      <Section
        title="Rejected"
        users={rejected}
        userState="rejected"
        sessionUserId={session!.user.id}
        emptyMessage="No rejected users"
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: implement admin user management page with approve/reject/revoke"
```

---

## Task 5: Smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Visit the admin page**

Go to http://localhost:3000/admin — you should see three sections: Pending, Approved, Rejected. Your own account should appear in the Approved section with "No actions" label (since you're the admin and `neq('role', 'admin')` excludes admins, you won't appear — that's correct).

- [ ] **Step 3: Test with a second account (optional)**

If you have a second Google account:
1. Open an incognito window and sign in with the second account
2. You'll land on `/pending` — that's expected
3. Go back to your main browser, visit `/admin` — the second account should appear in **Pending**
4. Click **Approve** — row should move to **Approved** after page refresh
5. Click **Revoke** — row should move back to **Pending**
6. Click **Reject** — row should appear in **Rejected**
7. Click **Approve** from Rejected — row should move to **Approved**

- [ ] **Step 4: Verify route protection**

Log out, sign in with the second (non-admin) account. Try navigating to http://localhost:3000/admin — you should be redirected to `/dashboard` (the proxy middleware handles this).

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "chore: Phase 3 complete — admin user management verified"
```
