# SaaS Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal `src/app/page.tsx` with a full single-page SaaS marketing site including Nav, Hero, Screenshot Slider, Features, Testimonials, Pricing, CTA, and Footer.

**Architecture:** Single `src/app/page.tsx` file rewritten as a `"use client"` component. Auto-rotating screenshot slider uses `useState` + `useEffect`. All sections use existing Tailwind v4 utility classes and the app's existing dark theme tokens (emerald accent, DM Sans/Syne fonts). No new dependencies.

**Tech Stack:** Next.js App Router, React 19, Tailwind v4, shadcn/ui button component, lucide-react icons

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/app/page.tsx` | Full landing page — all sections in one file |
| Create | `public/images/screenshots/` | Directory for 9 screenshot images |

---

### Task 1: Add screenshot images

**Files:**
- Create: `public/images/screenshots/` (directory + images)

- [ ] **Step 1: Create the screenshots directory**

```bash
mkdir -p public/images/screenshots
```

- [ ] **Step 2: Copy your 9 screenshot files into `public/images/screenshots/`**

Name them exactly:
```
screenshot-1.png
screenshot-2.png
screenshot-3.png
screenshot-4.png
screenshot-5.png
screenshot-6.png
screenshot-7.png
screenshot-8.png
screenshot-9.png
```

Any image format works (`.png`, `.jpg`, `.webp`) — just update the extension in Task 2 if not `.png`.

- [ ] **Step 3: Verify they're accessible**

Start the dev server (`npm run dev`) and open `http://localhost:3000/images/screenshots/screenshot-1.png` in your browser. You should see your image.

- [ ] **Step 4: Commit**

```bash
git add public/images/screenshots/
git commit -m "feat: add app screenshots for landing page"
```

---

### Task 2: Build the landing page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace `src/app/page.tsx` with the full landing page**

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Search, Bot, LayoutDashboard } from 'lucide-react'

const SCREENSHOTS = Array.from({ length: 9 }, (_, i) => `/images/screenshots/screenshot-${i + 1}.png`)

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

export default function LandingPage() {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SCREENSHOTS.length)
    }, 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-heading text-lg font-bold text-primary">⚡ Lead Scout</span>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <Link href="/login" className={cn(buttonVariants({ size: 'sm' }), 'px-4')}>
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-28 text-center">
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'radial-gradient(oklch(0.38 0.005 250) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,oklch(0.22_0.06_162/0.25),transparent)]" />

        <div className="relative z-10 max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-800/40 bg-emerald-900/30 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium tracking-wide text-emerald-400">AI-Powered Lead Discovery</span>
          </div>

          <h1 className="font-heading mb-4 text-5xl font-extrabold leading-tight tracking-tight text-zinc-100">
            Find businesses that
            <br />
            <span className="text-emerald-400">need your services</span>
          </h1>

          <p className="mx-auto mb-8 max-w-md text-lg leading-relaxed text-zinc-400">
            Discover local businesses without websites, score them with AI, and turn cold leads into paying clients.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className={cn(buttonVariants({ size: 'lg' }), 'px-8')}>
              Get Started Free
            </Link>
            <a
              href="#screenshots"
              className="flex items-center gap-1 rounded-md border border-border px-6 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              See how it works ↓
            </a>
          </div>
        </div>
      </section>

      {/* SCREENSHOT SLIDER */}
      <section id="screenshots" className="border-t border-border/40 bg-card/30 px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">See it in action</p>
          <h2 className="font-heading mb-10 text-3xl font-bold text-foreground">Everything you need in one place</h2>

          <div className="relative overflow-hidden rounded-xl border border-border shadow-2xl">
            <Image
              key={current}
              src={SCREENSHOTS[current]}
              alt={`App screenshot ${current + 1}`}
              width={1200}
              height={750}
              className="w-full object-cover"
              priority={current === 0}
            />
          </div>

          {/* Dots */}
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
      <section id="features" className="border-t border-border/40 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Why Lead Scout</p>
            <h2 className="font-heading text-3xl font-bold text-foreground">Built for freelance developers</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-xl border border-border bg-card p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900/30 text-emerald-400">
                  <Icon size={20} />
                </div>
                <h3 className="font-heading mb-2 font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="border-t border-border/40 bg-card/30 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">What users say</p>
            <h2 className="font-heading text-3xl font-bold text-foreground">Loved by freelancers</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {TESTIMONIALS.map(({ quote, name, role }, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-6">
                <p className="mb-1 text-sm text-emerald-400">★★★★★</p>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">"{quote}"</p>
                <p className="text-xs font-medium text-foreground">{name}</p>
                <p className="text-xs text-muted-foreground">{role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-t border-border/40 px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Pricing</p>
          <h2 className="font-heading mb-2 text-3xl font-bold text-foreground">Simple, honest pricing</h2>
          <p className="mb-12 text-muted-foreground">Start free. Upgrade when you're ready.</p>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Free */}
            <div className="rounded-xl border border-border bg-card p-8 text-left">
              <h3 className="font-heading mb-1 font-bold text-foreground">Free</h3>
              <div className="mb-6">
                <span className="font-heading text-4xl font-extrabold text-primary">$0</span>
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
                Get Started Free
              </Link>
            </div>

            {/* Pro */}
            <div className="relative rounded-xl border border-primary/50 bg-emerald-950/20 p-8 text-left">
              <span className="absolute -top-3 right-4 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
                COMING SOON
              </span>
              <h3 className="font-heading mb-1 font-bold text-foreground">Pro</h3>
              <div className="mb-6">
                <span className="font-heading text-4xl font-extrabold text-primary">TBD</span>
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
                Coming Soon
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative border-t border-border/40 overflow-hidden px-6 py-28 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_110%,oklch(0.22_0.06_162/0.2),transparent)]" />
        <div className="relative z-10 mx-auto max-w-xl">
          <h2 className="font-heading mb-4 text-4xl font-extrabold text-foreground">Ready to find your next client?</h2>
          <p className="mb-8 text-muted-foreground">Join freelancers already using Lead Scout to grow their business.</p>
          <Link href="/login" className={cn(buttonVariants({ size: 'lg' }), 'px-10')}>
            Get Started — It's Free
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/40 px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Lead Scout</p>
          <div className="flex gap-4">
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Verify the page renders without errors**

```bash
npm run dev
```

Open `http://localhost:3000`. You should see the full landing page with nav, hero, slider (cycling screenshots), features, testimonials, pricing, CTA, and footer. No console errors.

- [ ] **Step 3: Verify the slider works**

Watch the screenshot area for ~10 seconds. Images should rotate automatically every 3 seconds. Clicking dots should jump to that slide.

- [ ] **Step 4: Verify nav anchor links**

Click "Features" in the nav — page should scroll to the features section. Click "Pricing" — should scroll to pricing section.

- [ ] **Step 5: Verify all CTAs link correctly**

- "Get Started Free" (hero) → `/login`
- "Sign In" (nav) → `/login`
- "Get Started Free" (pricing Free tier) → `/login`
- "Coming Soon" button → disabled, does not navigate

- [ ] **Step 6: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: replace landing page with full SaaS marketing page"
```

---

### Task 3: Add .gitignore entry for brainstorm files

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add `.superpowers/` to `.gitignore`**

Open `.gitignore` and add this line:

```
.superpowers/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore .superpowers brainstorm session files"
```
