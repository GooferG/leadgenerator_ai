'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Search, Bot, LayoutDashboard } from 'lucide-react'

const SCREENSHOTS = [
  { base: 'hook-dashboard', alt: 'Dashboard' },
  { base: 'hook-search',    alt: 'Search' },
  { base: 'hook-lead',      alt: 'Lead detail' },
]

const FEATURES = [
  {
    icon: Search,
    title: 'Smart Search',
    description: 'Find local businesses missing a web presence using Google Places data.',
  },
  {
    icon: Bot,
    title: 'AI Scoring',
    description: 'Claude AI rates each lead hot, warm, or cold so you focus on the best ones first.',
  },
  {
    icon: LayoutDashboard,
    title: 'Lead Pipeline',
    description: 'Track every lead from discovery to closed deal in one clean dashboard.',
  },
]

const TESTIMONIALS = [
  { quote: 'Replace this with a real user quote once you have early adopters.', name: 'Your Name', role: 'Freelance Developer' },
  { quote: 'Replace this with a real user quote once you have early adopters.', name: 'Your Name', role: 'Web Designer' },
  { quote: 'Replace this with a real user quote once you have early adopters.', name: 'Your Name', role: 'Agency Owner' },
]

const FREE_FEATURES = [
  { text: '50 leads/month', included: true },
  { text: 'AI scoring', included: true },
  { text: 'Lead dashboard', included: true },
  { text: 'Export leads', included: false },
  { text: 'Priority support', included: false },
]

const PRO_FEATURES = [
  { text: 'Unlimited leads', included: true },
  { text: 'AI scoring', included: true },
  { text: 'Lead dashboard', included: true },
  { text: 'Export leads', included: true },
  { text: 'Priority support', included: true },
]

const TRUST_SIGNALS = [
  'Used by 240+ freelance devs',
  '★ 4.9 Product Hunt #2',
  'SOC 2 Type II',
  'Cancel anytime',
]

export default function LandingPage() {
  const [current, setCurrent] = useState(0)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('hook-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = saved ? saved === 'dark' : prefersDark
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('hook-theme', next ? 'dark' : 'light')
  }

  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SCREENSHOTS.length)
    }, 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#" className="font-sans font-bold text-sm tracking-[-0.03em] text-foreground">⌐ Hook</a>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Features</a>
            <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Pricing</a>
            <Link href="/login" className={cn(buttonVariants({ size: 'sm' }))}>
              Sign in
            </Link>
          </div>
          <button
            onClick={toggleTheme}
            className="size-8 rounded-full border border-border hover:bg-secondary transition-colors flex items-center justify-center text-sm"
            aria-label="Toggle theme"
          >
            {dark ? '☾' : '☀'}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="flex flex-col items-center justify-center px-6 py-28 text-center">
        <div className="max-w-2xl">
          <h1 className="font-sans mb-6 text-7xl font-bold leading-[0.92] tracking-[-0.05em] text-foreground">
            Stop pitching.<br />
            Start{' '}
            <span className="inline-block bg-primary text-primary-foreground px-4 italic rounded-full">
              hooking.
            </span>
          </h1>

          <p className="mx-auto mb-8 max-w-md text-lg leading-relaxed text-muted-foreground">
            Hook scans your local market for businesses without websites, scores them, and writes the cold email. You just hit send.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            <Link href="/login" className={cn(buttonVariants({ size: 'lg' }))}>
              Get started — free
            </Link>
            <a
              href="#screenshots"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
            >
              See how it works ↓
            </a>
          </div>

          <div className="border-t border-border pt-6">
            <div className="grid grid-cols-4 gap-4">
              {TRUST_SIGNALS.map((signal) => (
                <p key={signal} className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  {signal}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SCREENSHOT SLIDER */}
      <section id="screenshots" className="border-t border-border bg-secondary/30 px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">See it in action</p>
          <h2 className="font-sans mb-10 text-3xl font-semibold tracking-tight text-foreground">Everything in one place</h2>

          <div className="relative overflow-hidden rounded-2xl border border-border shadow-2xl">
            <Image
              key={`${current}-${dark}`}
              src={`/images/screenshots/${SCREENSHOTS[current].base}-${dark ? 'dark' : 'light'}.png`}
              alt={SCREENSHOTS[current].alt}
              width={1200}
              height={750}
              className="w-full object-cover"
              priority
              loading="eager"
            />
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5">
            {SCREENSHOTS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === current ? 'w-5 bg-primary' : 'w-1.5 bg-border hover:bg-muted-foreground'
                )}
                aria-label={`Go to screenshot ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Why Hook</p>
            <h2 className="font-sans text-3xl font-semibold tracking-tight text-foreground">Built for freelance developers</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary border border-border text-foreground">
                  <Icon size={20} />
                </div>
                <h3 className="font-sans mb-2 font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="border-t border-border bg-secondary/30 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">What users say</p>
            <h2 className="font-sans text-3xl font-semibold tracking-tight text-foreground">Loved by freelancers</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {TESTIMONIALS.map(({ quote, name, role }, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-6">
                <p className="mb-1 text-sm text-foreground">★★★★★</p>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">&ldquo;{quote}&rdquo;</p>
                <p className="text-xs font-medium text-foreground">{name}</p>
                <p className="text-xs text-muted-foreground">{role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Pricing</p>
          <h2 className="font-sans mb-2 text-3xl font-semibold tracking-tight text-foreground">Simple, honest pricing</h2>
          <p className="mb-12 text-muted-foreground">Start free. Upgrade when you&apos;re ready.</p>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Free */}
            <div className="rounded-2xl border border-border bg-card p-8 text-left">
              <h3 className="font-sans mb-1 font-semibold text-foreground">Free</h3>
              <div className="mb-6">
                <span className="font-sans text-4xl font-bold text-foreground">$0</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <ul className="mb-8 space-y-2">
                {FREE_FEATURES.map(({ text, included }) => (
                  <li key={text} className={cn('flex items-center gap-2 text-sm', included ? 'text-foreground' : 'text-muted-foreground/50')}>
                    <span>{included ? '✓' : '✗'}</span>
                    {text}
                  </li>
                ))}
              </ul>
              <Link href="/login" className={cn(buttonVariants(), 'w-full justify-center')}>
                Get started — free
              </Link>
            </div>

            {/* Pro */}
            <div className="relative rounded-2xl border border-border bg-secondary/30 p-8 text-left">
              <span className="absolute -top-3 right-4 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
                COMING SOON
              </span>
              <h3 className="font-sans mb-1 font-semibold text-foreground">Pro</h3>
              <div className="mb-6">
                <span className="font-sans text-4xl font-bold text-foreground">TBD</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <ul className="mb-8 space-y-2">
                {PRO_FEATURES.map(({ text, included }) => (
                  <li key={text} className={cn('flex items-center gap-2 text-sm', included ? 'text-foreground' : 'text-muted-foreground/50')}>
                    <span>{included ? '✓' : '✗'}</span>
                    {text}
                  </li>
                ))}
              </ul>
              <button disabled className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-center opacity-50 cursor-not-allowed')}>
                Coming soon
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-border px-6 py-28 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="font-sans mb-4 text-4xl font-bold tracking-tight text-foreground">Ready to find your next client?</h2>
          <p className="mb-8 text-muted-foreground">Join freelancers already using Hook to grow their business.</p>
          <Link href="/login" className={cn(buttonVariants({ size: 'lg' }))}>
            Get started — free
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Hook</p>
          <div className="flex gap-4">
            <a href="#" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Privacy</a>
            <a href="#" className="text-xs text-muted-foreground transition-colors hover:text-foreground">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
