import { auth } from '@/auth'

export default async function DashboardPage() {
  const session = await auth()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">Welcome, {session?.user?.name}.</p>
      <p className="text-sm text-muted-foreground">
        Lead search and scoring coming in Phase 2.
      </p>
    </main>
  )
}
