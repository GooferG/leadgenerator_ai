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
