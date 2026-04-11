import Link from 'next/link'
import { signOut } from '@/auth'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface NavProps {
  userRole: 'user' | 'admin'
}

export function Nav({ userRole }: NavProps) {
  return (
    <nav className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between shrink-0">
      <Link href="/dashboard" className="font-bold text-sm">
        Lead Generator
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Dashboard
        </Link>
        <Link
          href="/search"
          className={cn(
            buttonVariants({ size: 'sm' }),
            'bg-indigo-600 hover:bg-indigo-700 text-white border-0'
          )}
        >
          Search
        </Link>
        {userRole === 'admin' && (
          <Link
            href="/admin"
            className="text-sm text-slate-400 hover:text-white transition-colors"
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
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </form>
    </nav>
  )
}
