# Lead Scout Phase 1: Scaffold + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold Lead Scout with Next.js 14, configure Google OAuth via NextAuth v5, Supabase Postgres database, and Next.js middleware-based route protection so only approved users can reach the dashboard.

**Architecture:** NextAuth v5 handles Google OAuth and stores auth state in a JWT; Supabase stores users with `approved`/`role` fields managed server-side; Next.js middleware reads the JWT on every request to gate routes before any React code runs. The first sign-in matching `ADMIN_EMAIL` is auto-approved with `role=admin`; all others get `approved=false` and wait for manual DB approval.

**Tech Stack:** Next.js 14 (App Router, TypeScript, Tailwind CSS), shadcn/ui, NextAuth v5 (`next-auth@beta`), `@supabase/supabase-js`, Vercel

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/app/layout.tsx` | Root layout with Tailwind font setup |
| `src/app/page.tsx` | Public landing page |
| `src/app/login/page.tsx` | Google sign-in button page |
| `src/app/pending/page.tsx` | "Awaiting approval" message |
| `src/app/dashboard/page.tsx` | Protected placeholder dashboard |
| `src/app/admin/page.tsx` | Admin-only placeholder |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth route handler |
| `src/auth.ts` | NextAuth config: providers, signIn/jwt/session callbacks |
| `src/middleware.ts` | Route protection: unauthenticated→/login, unapproved→/pending, non-admin→/dashboard |
| `src/lib/supabase.ts` | Supabase client (anon) + supabaseAdmin (service role) |
| `src/types/next-auth.d.ts` | Extend NextAuth Session/JWT types with `approved`, `role`, `id` |
| `supabase/migrations/001_initial.sql` | `users` and `leads` table DDL |
| `.env.local.example` | All required env var names with comments |

---

## Task 1: Initialize the Next.js 14 project

**Files:**
- Create: entire project scaffold via `create-next-app`

- [ ] **Step 1: Run create-next-app**

Run this from the `leadgenerator/` directory (which should be empty):

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --no-eslint \
  --import-alias "@/*"
```

When prompted:
- Would you like to use ESLint? → **No** (we passed `--no-eslint`)
- Any other prompts → accept defaults

- [ ] **Step 2: Verify scaffold**

```bash
ls src/app
```

Expected output includes: `favicon.ico  globals.css  layout.tsx  page.tsx`

- [ ] **Step 3: Confirm dev server starts**

```bash
npm run dev
```

Expected: Server starts on http://localhost:3000 with the default Next.js page. Stop with Ctrl+C.

- [ ] **Step 4: Initial commit**

```bash
git init
git add .
git commit -m "feat: initialize Next.js 14 project with TypeScript and Tailwind"
```

---

## Task 2: Initialize shadcn/ui and install all dependencies

**Files:**
- Modify: `tailwind.config.ts`, `src/app/globals.css` (by shadcn CLI)
- Create: `components.json`, `src/lib/utils.ts` (by shadcn CLI)
- Create: `src/components/ui/button.tsx` (by shadcn CLI)

- [ ] **Step 1: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

Answer the prompts as follows:
- Which style would you like to use? → **Default**
- Which color would you like to use as the base color? → **Slate**
- Would you like to use CSS variables for theming? → **Yes**

- [ ] **Step 2: Add the Button component**

```bash
npx shadcn@latest add button
```

Expected: Creates `src/components/ui/button.tsx`

- [ ] **Step 3: Install NextAuth v5 and Supabase**

```bash
npm install next-auth@beta @supabase/supabase-js
```

- [ ] **Step 4: Verify installations**

```bash
npm ls next-auth @supabase/supabase-js
```

Expected: Both packages listed without errors. `next-auth` version should be `5.x.x-beta.x`.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add shadcn/ui, NextAuth v5, and Supabase dependencies"
```

---

## Task 3: Create .env.local.example and TypeScript type extensions

**Files:**
- Create: `.env.local.example`
- Create: `src/types/next-auth.d.ts`

- [ ] **Step 1: Create .env.local.example**

Create the file `/.env.local.example` with the following content:

```bash
# ─── Google OAuth ────────────────────────────────────────────────────────────
# Create at https://console.cloud.google.com → APIs & Services → Credentials
# Authorized redirect URIs: http://localhost:3000/api/auth/callback/google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ─── NextAuth ────────────────────────────────────────────────────────────────
# Generate with: openssl rand -base64 32
AUTH_SECRET=
# Your deployment URL (no trailing slash). Use http://localhost:3000 locally.
NEXTAUTH_URL=http://localhost:3000

# ─── Supabase ────────────────────────────────────────────────────────────────
# Found in Supabase dashboard → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Service role key — never expose to client. Used only in server-side auth callbacks.
SUPABASE_SERVICE_ROLE_KEY=

# ─── App Config ──────────────────────────────────────────────────────────────
# The Google email address that gets auto-approved as admin on first sign-in
ADMIN_EMAIL=

# ─── Google Places API ───────────────────────────────────────────────────────
# Used in Phase 2 for business search
GOOGLE_PLACES_API_KEY=
```

- [ ] **Step 2: Create TypeScript type extensions for NextAuth**

Create `src/types/next-auth.d.ts`:

```typescript
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      approved: boolean
      role: 'user' | 'admin'
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    approved?: boolean
    role?: 'user' | 'admin'
    userId?: string
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add env.local.example and NextAuth TypeScript type extensions"
```

---

## Task 4: Create Supabase database schema

**Files:**
- Create: `supabase/migrations/001_initial.sql`

> **⚠️ EXTERNAL SETUP REQUIRED — Do this before continuing:**
>
> 1. Go to https://supabase.com → New project
> 2. Choose a name (e.g. `lead-scout`), set a DB password, pick a region close to you
> 3. Wait ~2 minutes for provisioning
> 4. Go to **Project Settings → API**
> 5. Copy:
>    - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
>    - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
>    - **service_role** key (click "Reveal") → `SUPABASE_SERVICE_ROLE_KEY`
>
> You will apply the SQL in Step 2 via the Supabase SQL editor.

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/001_initial.sql`:

```sql
-- Users table
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  image text,
  approved boolean not null default false,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- Leads table
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  website text,
  score text check (score in ('hot', 'warm', 'cold')),
  score_label text,
  reasoning text,
  pitch text,
  status text not null default 'new' check (status in ('new', 'contacted', 'converted')),
  notes text,
  maps_url text,
  created_at timestamptz not null default now()
);

-- Indexes for common query patterns
create index if not exists leads_user_id_idx on leads(user_id);
create index if not exists leads_status_idx on leads(status);
create index if not exists users_email_idx on users(email);
```

- [ ] **Step 2: Apply the schema to Supabase**

1. In your Supabase project, go to **SQL Editor → New query**
2. Paste the entire contents of `supabase/migrations/001_initial.sql`
3. Click **Run**
4. Expected: "Success. No rows returned"
5. Verify in **Table Editor** — you should see `users` and `leads` tables

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add Supabase database schema for users and leads"
```

---

## Task 5: Create Supabase client

**Files:**
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Create your `.env.local` file**

Copy `.env.local.example` to `.env.local` and fill in the three Supabase values you copied in Task 4:

```bash
cp .env.local.example .env.local
```

Then open `.env.local` and set:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Leave the Google OAuth and AUTH_SECRET fields empty for now — you'll fill them in Task 7.

- [ ] **Step 2: Create the Supabase client module**

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client for browser use (anon key, respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side use only (service role, bypasses RLS)
// Never import this in client components
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)
```

- [ ] **Step 3: Verify the module resolves**

```bash
npx tsc --noEmit
```

Expected: No errors (env vars won't be validated at compile time).

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: add Supabase client and admin client"
```

---

## Task 6: Set up Google OAuth credentials

> **⚠️ EXTERNAL SETUP REQUIRED — Do this before continuing:**
>
> 1. Go to https://console.cloud.google.com
> 2. Create a new project (or select an existing one) → name it `Lead Scout`
> 3. Go to **APIs & Services → OAuth consent screen**
>    - User Type: **External**
>    - App name: `Lead Scout`, add your email as developer contact
>    - Scopes: add `email` and `profile` (these are the defaults)
>    - Save and continue through all steps
> 4. Go to **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
>    - Application type: **Web application**
>    - Name: `Lead Scout Dev`
>    - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
>    - Click **Create**
> 5. Copy **Client ID** → `GOOGLE_CLIENT_ID` in `.env.local`
> 6. Copy **Client Secret** → `GOOGLE_CLIENT_SECRET` in `.env.local`
>
> Also fill in these remaining `.env.local` values:
>
> ```bash
> # Generate a secret:
> openssl rand -base64 32
> ```
> Paste that output as `AUTH_SECRET`.
>
> Set `ADMIN_EMAIL` to your Google account email (the one you'll sign in with).
>
> Set `NEXTAUTH_URL=http://localhost:3000`

- [ ] **Step 1: Confirm all env vars are set**

Open `.env.local` and verify all of the following are non-empty:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAIL`

---

## Task 7: Configure NextAuth v5

**Files:**
- Create: `src/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create the NextAuth configuration**

Create `src/auth.ts`:

```typescript
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { supabaseAdmin } from '@/lib/supabase'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user }) {
      const email = user.email
      if (!email) return false

      // Check if this user already exists in our DB
      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (!existing) {
        // First sign-in: create the user row
        const isAdmin = email === process.env.ADMIN_EMAIL
        const { error } = await supabaseAdmin.from('users').insert({
          email,
          name: user.name ?? null,
          image: user.image ?? null,
          approved: isAdmin,
          role: isAdmin ? 'admin' : 'user',
        })

        if (error) {
          console.error('Failed to create user in DB:', error)
          return false
        }
      }

      return true
    },

    async jwt({ token, trigger }) {
      // Fetch DB fields on sign-in (trigger === 'signIn') or if not yet populated
      if (trigger === 'signIn' || token.approved === undefined) {
        const { data } = await supabaseAdmin
          .from('users')
          .select('id, approved, role')
          .eq('email', token.email as string)
          .single()

        if (data) {
          token.userId = data.id
          token.approved = data.approved
          token.role = data.role as 'user' | 'admin'
        }
      }
      return token
    },

    async session({ session, token }) {
      session.user.id = token.userId as string
      session.user.approved = token.approved as boolean
      session.user.role = token.role as 'user' | 'admin'
      return session
    },
  },
})
```

- [ ] **Step 2: Create the NextAuth route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from '@/auth'

export const { GET, POST } = handlers
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: No errors. If you see "Property 'approved' does not exist on type 'Session'", confirm `src/types/next-auth.d.ts` is present and `tsconfig.json` includes `src/types` (it does by default with `"include": ["src"]`).

- [ ] **Step 4: Commit**

```bash
git add src/auth.ts src/app/api/auth
git commit -m "feat: configure NextAuth v5 with Google OAuth and Supabase user sync"
```

---

## Task 8: Create middleware for route protection

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create middleware.ts**

Create `src/middleware.ts`:

```typescript
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Not authenticated → send to login
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Authenticated but not approved → send to pending
  if (!session.user.approved) {
    return NextResponse.redirect(new URL('/pending', req.url))
  }

  // Approved user trying to reach /admin without admin role → redirect to dashboard
  if (pathname.startsWith('/admin') && session.user.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

// Middleware runs only on these routes
export const config = {
  matcher: ['/dashboard/:path*', '/leads/:path*', '/admin/:path*'],
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add middleware to protect /dashboard, /leads, and /admin routes"
```

---

## Task 9: Create all application pages

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/login/page.tsx`
- Create: `src/app/pending/page.tsx`
- Create: `src/app/dashboard/page.tsx`
- Create: `src/app/admin/page.tsx`

- [ ] **Step 1: Update the root layout**

Replace the contents of `src/app/layout.tsx` with:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Lead Scout',
  description: 'Find local businesses that need websites',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Create the landing page**

Replace the contents of `src/app/page.tsx` with:

```typescript
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Lead Scout</h1>
      <p className="text-lg text-muted-foreground text-center max-w-md">
        Find local businesses that need websites. Powered by Google Places and AI lead scoring.
      </p>
      <Button asChild>
        <Link href="/login">Get Started</Link>
      </Button>
    </main>
  )
}
```

- [ ] **Step 3: Create the login page**

Create `src/app/login/page.tsx`:

```typescript
import { signIn } from '@/auth'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Sign in to Lead Scout</h1>
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
```

- [ ] **Step 4: Create the pending page**

Create `src/app/pending/page.tsx`:

```typescript
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
```

- [ ] **Step 5: Create the dashboard page**

Create `src/app/dashboard/page.tsx`:

```typescript
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
```

- [ ] **Step 6: Create the admin page**

Create `src/app/admin/page.tsx`:

```typescript
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
```

- [ ] **Step 7: Commit**

```bash
git add src/app
git commit -m "feat: add all Phase 1 pages (landing, login, pending, dashboard, admin)"
```

---

## Task 10: Smoke test the full auth flow

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test the landing page**

Open http://localhost:3000 — you should see the "Lead Scout" heading and "Get Started" button.

- [ ] **Step 3: Test unauthenticated redirect**

Navigate directly to http://localhost:3000/dashboard — you should be redirected to `/login`.

- [ ] **Step 4: Test Google sign-in as admin**

1. Click "Get Started" → click "Sign in with Google"
2. Choose the Google account matching your `ADMIN_EMAIL`
3. You should be redirected to `/dashboard` and see "Welcome, [your name]"

- [ ] **Step 5: Verify admin user was created in Supabase**

In Supabase → Table Editor → `users`:
- Your row should appear with `approved = true` and `role = 'admin'`

- [ ] **Step 6: Test the admin page**

Navigate to http://localhost:3000/admin — you should see the admin placeholder page with your email and role displayed.

- [ ] **Step 7: Test sign-in as a non-admin (optional)**

If you have a second Google account:
1. Sign out (or use an incognito window)
2. Sign in with the second account
3. Expected: redirected to `/pending`
4. In Supabase `users` table, the new row should have `approved = false`, `role = 'user'`

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "chore: Phase 1 complete — scaffold, auth, and route protection verified"
```

---

## Notes for Phase 2

- **Session staleness:** If an admin approves a user directly in Supabase, that user must sign out and back in for their session to reflect `approved = true`. A future phase can add an explicit "refresh session" mechanism or reduce JWT expiry.
- **Supabase RLS:** Row Level Security is currently disabled on both tables. Enable it in Phase 2 when client-side Supabase queries are introduced (leads CRUD).
- **Vercel deployment:** Add all `.env.local` variables to Vercel environment variables, and add your production URL as an additional Authorized Redirect URI in Google OAuth console: `https://your-app.vercel.app/api/auth/callback/google`.
