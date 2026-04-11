import { signOut } from '@/auth'
import { Button } from '@/components/ui/button'

export default function PendingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-amber-900/30 border border-amber-800/40 flex items-center justify-center text-xl">
        ⏳
      </div>

      <div>
        <h1 className="text-xl font-semibold text-zinc-100 mb-2">
          Access Pending
        </h1>
        <p className="text-zinc-500 text-sm max-w-xs leading-relaxed">
          Your account is awaiting admin approval. You&apos;ll gain access once
          approved.
        </p>
      </div>

      <form
        action={async () => {
          'use server'
          await signOut({ redirectTo: '/' })
        }}
      >
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>
    </main>
  )
}
