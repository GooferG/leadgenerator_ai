import { signIn } from '@/auth'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <div className="font-heading font-bold text-sm tracking-tight text-emerald-400 mb-6">
            Lead Generator
          </div>
          <h1 className="text-2xl font-semibold text-zinc-100 mb-2">
            Welcome back
          </h1>
          <p className="text-zinc-500 text-sm">
            Sign in to continue to your account
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <form
            action={async () => {
              'use server'
              await signIn('google', { redirectTo: '/dashboard' })
            }}
          >
            <Button type="submit" size="lg" className="w-full">
              Continue with Google
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-5">
          Access is by invitation only
        </p>
      </div>
    </main>
  )
}
