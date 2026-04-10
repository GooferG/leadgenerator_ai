import { signIn } from '@/auth'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Sign in to Lead Generator</h1>
      <form
        action={async () => {
          'use server'
          await signIn('google', { redirectTo: '/dashboard' })
        }}
      >
        <Button type="submit" size="lg">
          Sign in with Google
        </Button>
      </form>
    </main>
  )
}
