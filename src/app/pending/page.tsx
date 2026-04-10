import { signOut } from '@/auth'
import { Button } from '@/components/ui/button'

export default function PendingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-semibold">Access Pending</h1>
      <p className="text-muted-foreground max-w-sm">
        Your account has been created and is awaiting approval from an admin.
        You&apos;ll receive access once your account is approved.
      </p>
      <form
        action={async () => {
          'use server'
          await signOut({ redirectTo: '/' })
        }}
      >
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </main>
  )
}
