import Link from 'next/link'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-8 overflow-hidden">
      {/* Dot grid background */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(oklch(0.38 0.005 250) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* Radial glow at top */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,oklch(0.22_0.06_162/0.25),transparent)]" />
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-zinc-950 to-transparent" />

      <div className="relative z-10 text-center max-w-xl animate-fade-up">
        <div className="inline-flex items-center gap-2 bg-emerald-900/30 border border-emerald-800/40 rounded-full px-3 py-1 mb-7">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-xs font-medium text-emerald-400 tracking-wide">
            AI-powered lead intelligence
          </span>
        </div>

        <h1 className="font-heading text-5xl font-extrabold tracking-tight text-zinc-100 mb-4 leading-tight">
          Find businesses that
          <br />
          <span className="text-emerald-400">need your services</span>
        </h1>

        <p className="text-zinc-400 text-lg mb-8 leading-relaxed max-w-md mx-auto">
          Discover local businesses without websites. Scored and ranked by AI
          so you pitch the right leads first.
        </p>

        <Link
          href="/login"
          className={cn(buttonVariants({ size: 'lg' }), 'px-8 h-11 text-sm font-semibold')}
        >
          Get Started
        </Link>
      </div>
    </main>
  )
}
