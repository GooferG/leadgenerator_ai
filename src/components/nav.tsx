import Link from 'next/link'
import { signOut } from '@/auth'

interface NavProps {
  userRole: 'user' | 'admin'
}

export function Nav({ userRole }: NavProps) {
  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm px-6 h-14 flex items-center justify-between shrink-0">
      <Link
        href="/dashboard"
        className="font-heading font-bold text-sm tracking-tight text-zinc-100 hover:text-emerald-400 transition-colors"
      >
        Lead Generator
      </Link>

      <div className="flex items-center gap-1">
        <Link
          href="/dashboard"
          className="text-sm px-3 py-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 rounded-md transition-colors"
        >
          Dashboard
        </Link>
        <Link
          href="/search"
          className="text-sm px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-md transition-colors"
        >
          Search
        </Link>
        {userRole === 'admin' && (
          <Link
            href="/admin"
            className="text-sm px-3 py-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 rounded-md transition-colors"
          >
            Admin
          </Link>
        )}
      </div>

      <form
        action={async () => {
          'use server'
          await signOut({ redirectTo: '/' })
        }}
      >
        <button
          type="submit"
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1"
        >
          Sign out
        </button>
      </form>
    </nav>
  )
}
