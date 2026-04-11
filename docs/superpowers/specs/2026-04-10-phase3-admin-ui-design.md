# Lead Generator Phase 3: Admin User Approval UI — Design Spec

**Goal:** Replace the admin placeholder with a full user management UI that lets the admin approve, reject, and revoke access for any user.

**Date:** 2026-04-10

---

## Approach

Single admin page (Server Component) + one API route. Follows the same pattern as Phase 2: Server Component fetches Supabase directly, action buttons are a Client Component that calls the API route.

---

## DB State Model

No migration needed. The existing `users` table columns are repurposed:

| User state | `approved` | `role` |
|---|---|---|
| Pending (new signup) | false | 'user' |
| Approved | true | 'user' |
| Rejected | false | 'rejected' |
| Admin | true | 'admin' |

The `role` check constraint in the DB currently only allows `'user'` and `'admin'`. A migration is needed to add `'rejected'` as a valid value.

---

## Files

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/003_add_rejected_role.sql` | Create | Extend role check constraint to allow 'rejected' |
| `src/app/api/admin/users/[id]/route.ts` | Create | PATCH — approve/reject/revoke a user (admin only) |
| `src/app/admin/page.tsx` | Replace | Server Component — fetches all users, renders table |
| `src/app/admin/user-actions.tsx` | Create | Client Component — action buttons with optimistic UI |

---

## API Route: `PATCH /api/admin/users/[id]`

**Auth:** Rejects with 403 if `session.user.role !== 'admin'`.

**Input:**
```json
{ "action": "approve" | "reject" | "revoke" }
```

**Action → DB update mapping:**

| action | approved | role |
|---|---|---|
| approve | true | 'user' |
| reject | false | 'rejected' |
| revoke | false | 'user' |

**Guards:**
- Cannot act on yourself (returns 400 "Cannot modify your own account")
- Cannot act on another admin (returns 400 "Cannot modify an admin account")

**Output:** Updated user row.

---

## Admin Page (`/admin`)

Server Component. Fetches all users ordered by `created_at` desc. Groups into three sections rendered in order:

1. **Pending** — `approved = false AND role = 'user'`
2. **Approved** — `approved = true AND role = 'user'` (excludes admins)
3. **Rejected** — `role = 'rejected'`

Admins are not shown in any section (they manage the app, not a user to be managed).

**Each user row shows:**
- Google avatar (img tag, falls back to initials if null)
- Name + email
- Joined date (formatted as "Apr 10, 2026")
- Action buttons (from `UserActions` client component)

**Action buttons per state:**

| State | Buttons |
|---|---|
| Pending | Approve (green), Reject (red) |
| Approved | Revoke (orange) |
| Rejected | Approve (green) |

**Empty states:**
- "No pending users" / "No approved users" / "No rejected users" — shown per section if empty.

---

## UserActions Client Component

Receives: `userId`, `currentState` ('pending' | 'approved' | 'rejected'), `sessionUserId`.

Handles:
- Calling `PATCH /api/admin/users/[id]` with the chosen action
- Optimistic UI: disables buttons while request is in flight, shows "Saving…"
- On success: `router.refresh()` to re-fetch the Server Component data
- On error: shows inline error message next to the buttons

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Non-admin visits /admin | Middleware already redirects to /dashboard |
| API called by non-admin | Returns 403 |
| Admin tries to modify themselves | Returns 400, shown as inline error |
| Admin tries to modify another admin | Returns 400, shown as inline error |
| Supabase update fails | Returns 500, shown as inline error |

---

## Session Staleness

When a user is approved or revoked, their active session JWT does not update until they sign out and back in. This is acceptable — the middleware checks `approved` on every request, but it reads from the JWT (not live DB). A revoked user with an active session can still reach protected pages until their JWT expires or they re-authenticate.

For a low-traffic gated app this is acceptable. A future phase could force re-authentication by invalidating sessions server-side.

---

## What's NOT in Phase 3

- Email notifications to users on approval/rejection
- Batch approve/reject
- Admin promotion (making another user an admin) — requires direct DB access for now
- Forced session invalidation on revoke
