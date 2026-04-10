import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Lead Generator</h1>
      <p className="text-lg text-muted-foreground text-center max-w-md">
        Find local businesses that need websites. Powered by Google Places and AI lead scoring.
      </p>
      <Link href="/login" className={buttonVariants({ size: 'lg' })}>
        Get Started
      </Link>
    </main>
  )
}
