import { signIn } from '@/auth'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <div className="font-sans font-bold text-sm tracking-[-0.03em] text-foreground mb-6">
            ⌐ Hook
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Welcome back
          </h1>
          <p className="text-muted-foreground text-sm">
            Sign in to continue to your account
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
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

        <p className="text-center text-xs text-muted-foreground mt-5">
          Access is by invitation only
        </p>
      </div>
    </main>
  )
}
