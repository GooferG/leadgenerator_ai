import Link from 'next/link'
import { signOut } from '@/auth'
import { ThemeToggle } from '@/components/theme-toggle'

interface NavProps {
  userRole: 'user' | 'admin'
}

export function Nav({ userRole }: NavProps) {
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm px-6 h-14 flex items-center justify-between shrink-0">
      <Link
        href="/dashboard"
        className="font-sans font-bold text-sm tracking-[-0.03em] text-foreground transition-colors"
      >
        ⌐ Hook
      </Link>

      <div className="flex items-center gap-1">
        <Link
          href="/dashboard"
          className="text-sm px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors"
        >
          Dashboard
        </Link>
        <Link
          href="/search"
          className="text-sm px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors"
        >
          Search
        </Link>
        {userRole === 'admin' && (
          <Link
            href="/admin"
            className="text-sm px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors"
          >
            Admin
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/' })
          }}
        >
          <button
            type="submit"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
          >
            Sign out
          </button>
        </form>
      </div>
    </nav>
  )
}
