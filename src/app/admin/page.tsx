import { auth } from '@/auth'

export default async function AdminPage() {
  const session = await auth()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="text-muted-foreground">
        Signed in as {session?.user?.email} (role: {session?.user?.role})
      </p>
      <p className="text-sm text-muted-foreground">
        User approval management coming in a future phase.
      </p>
    </main>
  )
}
