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
    <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-400 shrink-0">
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
    <div className="flex items-center justify-between py-3 px-4 bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar user={user} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-zinc-100 truncate">
            {user.name ?? '—'}
            {isSelf && (
              <span className="ml-2 text-xs text-zinc-600 font-normal">You</span>
            )}
          </div>
          <div className="text-xs text-zinc-500 truncate">{user.email}</div>
        </div>
      </div>
      <div className="flex items-center gap-4 ml-4 shrink-0">
        <span className="text-xs text-zinc-600 hidden sm:block">
          {formatDate(user.created_at)}
        </span>
        {isSelf ? (
          <span className="text-xs text-zinc-600 italic">No actions</span>
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
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
        {title}{' '}
        <span className="text-zinc-700">({users.length})</span>
      </h2>
      {users.length === 0 ? (
        <p className="text-sm text-zinc-600 py-4 text-center border border-dashed border-zinc-800 rounded-xl">
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
    <div className="max-w-3xl mx-auto p-6 animate-fade-up">
      <h1 className="font-heading text-2xl font-bold text-zinc-100 mb-1">
        User Management
      </h1>
      <p className="text-sm text-zinc-500 mb-8">
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
