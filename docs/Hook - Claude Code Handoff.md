# Hook — Rebrand Handoff

A spec for replacing the current "Lead Generator" theme with **Hook** — a sleek, sales-friendly, high-contrast modern direction. Light + dark modes. Drop this file into your repo (e.g. `docs/hook-rebrand.md`) and point Claude Code at it with the prompt at the bottom.

---

## 1 · Identity

| | |
|---|---|
| **Name** | Hook |
| **Wordmark** | `⌐ Hook` — small rotated `⌐` glyph, then "Hook" in Geist 700, `letter-spacing: -0.03em` |
| **Tagline** | "Stop pitching. Start hooking." |
| **Voice** | Confident, plain-spoken, sales-floor energy. Short sentences. No code metaphors. |
| **Audience** | Freelance web devs *talking to* small-business owners — UI lives between those two worlds, but leans toward the salesperson |

---

## 2 · Type

```
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');
```

| Token | Family | Use |
|---|---|---|
| `--font-sans` | `'Geist', system-ui, sans-serif` | Everything |
| `--font-heading` | `'Geist', system-ui, sans-serif` | Same family, weights 600–700 |
| `--font-mono` | `'Geist Mono', ui-monospace, monospace` | Stat numerals, eyebrow labels, code |

**Headings:** `font-weight: 600`, `letter-spacing: -0.025em` to `-0.05em` (tighter as size grows).
**Body:** `font-weight: 400`, `line-height: 1.55`.
**Eyebrow labels:** mono, 11px, `text-transform: uppercase`, `letter-spacing: 0.08em`, muted color.

Replace `--font-syne` and `--font-dm-sans` in `globals.css`.

---

## 3 · Color tokens (replace `:root` and add `.dark` in `globals.css`)

The current file uses oklch. Keep that pattern. Below are the new values.

### Light mode — `:root`

```css
:root {
  --background:        oklch(1 0 0);              /* #ffffff */
  --foreground:        oklch(0 0 0);              /* #000000 */
  --card:              oklch(1 0 0);
  --card-foreground:   oklch(0 0 0);
  --popover:           oklch(1 0 0);
  --popover-foreground:oklch(0 0 0);

  /* PRIMARY = pure black. This is the rebrand's biggest move. */
  --primary:           oklch(0 0 0);
  --primary-foreground:oklch(1 0 0);

  --secondary:           oklch(0.96 0 0);          /* #f5f5f5 */
  --secondary-foreground:oklch(0.15 0 0);

  --muted:             oklch(0.96 0 0);
  --muted-foreground:  oklch(0.45 0 0);            /* #737373 */

  --accent:            oklch(0.96 0 0);
  --accent-foreground: oklch(0 0 0);

  --destructive:       oklch(0.577 0.245 27.325); /* keep existing red */

  --border:            oklch(0.92 0 0);            /* #e5e5e5 */
  --input:             oklch(0.92 0 0);
  --ring:              oklch(0 0 0);

  /* Score colors — monochrome, NOT colored. Hot = solid black, warm = gray, cold = outline. */
  --score-hot-bg:      oklch(0 0 0);
  --score-hot-fg:      oklch(1 0 0);
  --score-warm-bg:     oklch(0.96 0 0);
  --score-warm-fg:     oklch(0 0 0);
  --score-cold-bg:     transparent;
  --score-cold-fg:     oklch(0.6 0 0);
  --score-cold-border: oklch(0.92 0 0);

  --radius: 0.875rem;        /* was 0.5rem — bump for soft, modern feel */
}
```

### Dark mode — `.dark`

```css
.dark {
  --background:         oklch(0 0 0);              /* pure black */
  --foreground:         oklch(1 0 0);
  --card:               oklch(0 0 0);
  --card-foreground:    oklch(1 0 0);
  --popover:            oklch(0.04 0 0);           /* #0a0a0a */
  --popover-foreground: oklch(1 0 0);

  --primary:            oklch(1 0 0);              /* invert: white in dark */
  --primary-foreground: oklch(0 0 0);

  --secondary:           oklch(0.04 0 0);           /* #0a0a0a */
  --secondary-foreground:oklch(1 0 0);

  --muted:              oklch(0.04 0 0);
  --muted-foreground:   oklch(0.65 0 0);            /* #a3a3a3 */

  --accent:             oklch(0.04 0 0);
  --accent-foreground:  oklch(1 0 0);

  --destructive:        oklch(0.704 0.191 22.216);

  --border:             oklch(0.18 0 0);            /* #1f1f1f */
  --input:              oklch(0.18 0 0);
  --ring:               oklch(1 0 0);

  --score-hot-bg:       oklch(1 0 0);
  --score-hot-fg:       oklch(0 0 0);
  --score-warm-bg:      oklch(0.18 0 0);
  --score-warm-fg:      oklch(1 0 0);
  --score-cold-bg:      transparent;
  --score-cold-fg:      oklch(0.55 0 0);
  --score-cold-border:  oklch(0.18 0 0);
}
```

> **Big change:** drop the emerald `--primary`. Hook's primary is the foreground itself (black on light, white on dark). Score badges are monochrome — saturation is removed deliberately so the *content* is the only color in the UI.

---

## 4 · Mode toggle

Add to `src/components/nav.tsx` (or wherever the user menu lives):

- A small icon button that toggles `dark` class on `<html>`.
- Persist to `localStorage` under `hook-theme`.
- On mount, read storage; fallback to `prefers-color-scheme`.
- Default = **light** (sales people work in well-lit rooms; current dark default does not fit the new persona).

```tsx
// src/components/theme-toggle.tsx — new file
'use client'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const saved = localStorage.getItem('hook-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = saved ? saved === 'dark' : prefersDark
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])
  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('hook-theme', next ? 'dark' : 'light')
  }
  return (
    <button onClick={toggle}
      className="size-8 rounded-full border border-border hover:bg-secondary transition-colors flex items-center justify-center text-sm">
      {dark ? '☾' : '☀'}
    </button>
  )
}
```

---

## 5 · Component conventions

### Buttons
- **All buttons are pill-shaped:** `rounded-full`. Override `buttonVariants` in `src/components/ui/button.tsx`.
- Default: `bg-primary text-primary-foreground` (black on light, white on dark).
- Outline: `border border-border bg-transparent text-foreground hover:bg-secondary`.
- Sizes: `sm` h-8 px-4 · `default` h-9 px-5 · `lg` h-11 px-7.
- No translate-on-active animation — replace with subtle `active:opacity-90`.

### Cards
- `rounded-2xl` (matches `--radius` × 1.6).
- `border border-border bg-card`.
- No shadows in light mode. In dark mode, optional `shadow-[0_0_0_1px_rgba(255,255,255,0.04)]` for elevation.

### Filter pills (dashboard)
- `rounded-full px-3 py-1 text-xs`.
- Active: `bg-primary text-primary-foreground` (NOT `bg-zinc-100`).
- Inactive: `border border-border text-muted-foreground`.

### Score badges
| Score | Treatment |
|---|---|
| **Hot** | Solid `--score-hot-bg` / `--score-hot-fg`, rounded-full pill |
| **Warm** | `--score-warm-bg` / `--score-warm-fg`, rounded-full pill |
| **Cold** | Outlined: `border border-[--score-cold-border] text-[--score-cold-fg]` |

Remove all amber/yellow/blue from `dashboard/page.tsx` and `lead detail` — hot is *not* a warning, it's the headline.

### Lead row (dashboard)
Each row gets a 36×36 rounded-xl avatar showing the business's initials (first letter of first two words). Use `bg-secondary border border-border`.

### Stat cards (dashboard top)
4 cards, not 3:

1. **Total** — neutral
2. **Hot** — **inverted: `bg-primary text-primary-foreground`** (the hero stat)
3. **Contacted** — neutral
4. **Won** (new) — neutral, with `$X,XXX MRR` subtitle

Each shows a large 36px Geist 600 number, a 12px muted label, and a 11px "+N this week" subtitle.

### Empty / loading states
Replace pulsing skeletons with a single calm shimmer on `bg-secondary`. Empty state: short headline + one pill CTA, no decoration.

### Microcopy edits

| Old | New |
|---|---|
| "Find businesses that need your services" | "Stop pitching. Start hooking." |
| "Discover local businesses without websites…" | "Hook scans your local market for businesses without websites, scores them, and writes the cold email. You just hit send." |
| "Get Started" | "Get started — free" |
| "Find Leads" (search page H1) | "New search" |
| "AI Analysis" (lead detail card) | "Why hot" / "Why warm" / "Why cold" — dynamic per score |
| "Suggested pitch" | "Cold open" |
| "Scoring failed" | "Couldn't score this one — try again?" |
| "Saved ✓" | "Saved" with a small filled checkmark icon |

### Lead detail layout
Move from single-column to a **2-column grid** (1fr 360px):

- **Left column:** header (avatar + name + score badge inline), Cold open card, Why hot card.
- **Right column:** Mark contacted CTA (full-width pill), Contact card, Pipeline segmented control, "Saved 2 days ago · Last touched 4h" footer.

The Cold open card has Regenerate / Copy chips in the header. The opener body uses inline highlight pills for stat-like phrases (e.g. "127 five-star reviews") with `bg-secondary px-1 rounded`.

---

## 6 · Landing page

- Center-aligned, single column.
- Hero headline 120px Geist 700, line-height 0.92, `letter-spacing: -0.05em`.
- "hooking." sits in a black pill (or white in dark) with italic 400 weight.
- Below the CTA pair, a thin `border-t` separator and a 4-column row of mono-uppercase trust signals: `Used by 240+ freelance devs · ★ 4.9 Product Hunt #2 · SOC 2 Type II · Cancel anytime`.
- Drop the dot-grid background and emerald radial glow entirely.

---

## 7 · Files to touch

| File | Change |
|---|---|
| `src/app/globals.css` | Replace `:root`, add `.dark`, swap font vars |
| `src/app/layout.tsx` | Swap `next/font` from Syne+DM Sans to Geist+Geist Mono; default `<html>` to no class (light); ensure ThemeToggle script can hydrate |
| `src/components/ui/button.tsx` | `rounded-full` everywhere, new size scale, remove translate-on-active |
| `src/components/nav.tsx` | New wordmark (`⌐ Hook`), pill nav buttons, remove primary green Search button (use the same pill style as other nav items, use primary fill only on the active route), add `<ThemeToggle />` |
| `src/components/theme-toggle.tsx` | **New** — see §4 |
| `src/app/page.tsx` | Rewrite per §6. Drop the dot-grid + radial glow. |
| `src/app/login/page.tsx` | New wordmark, light-mode default styling, pill button |
| `src/app/dashboard/page.tsx` | 4 stat cards (add Won), inverted Hot card, monochrome score badges, avatar in lead row |
| `src/app/leads/[id]/page.tsx` | 2-column grid layout, "Cold open" + "Why hot" naming, inline highlights |
| `src/app/search/search-client.tsx` | Pill filter chips, monochrome score colors, "+ Save" → "Save" with icon |
| `src/app/admin/page.tsx` | Same nav + button changes flow through; otherwise minimal |
| `package.json` | Replace `next/font` registration if it's there; or just swap CSS imports |

Search-and-replace heuristic: any `bg-emerald-`, `text-emerald-`, `text-amber-`, `bg-amber-`, `text-yellow-`, `bg-yellow-`, `text-blue-`, `bg-blue-` in JSX should be reviewed and likely replaced with `bg-foreground/text-background`, `bg-secondary`, `border-border`, etc.

---

## 8 · Acceptance checklist

- [ ] Toggling theme changes every screen with no flash
- [ ] No emerald, amber, yellow, or blue anywhere in the rendered UI
- [ ] All buttons are `rounded-full`
- [ ] Wordmark reads `⌐ Hook` in nav and login
- [ ] Landing headline is the H1 "Stop pitching. Start hooking." with the pill on "hooking."
- [ ] Dashboard shows 4 stat cards; the Hot card is inverted
- [ ] Score badges are: Hot=filled, Warm=secondary, Cold=outlined
- [ ] Lead detail uses 2-column grid with Cold open + Why hot cards
- [ ] Default theme is light; preference persists across reloads
- [ ] All Syne / DM Sans references gone from `globals.css`, `layout.tsx`, and `package.json`

---

## 9 · Prompt to give Claude Code

> Read `docs/hook-rebrand.md` end-to-end before writing any code, then implement the rebrand exactly as specified. This is a full visual replacement of the current "Lead Generator" theme with the new "Hook" identity. Work in this order: (1) tokens & fonts in `globals.css` and `layout.tsx`, (2) `ThemeToggle` component + nav integration, (3) `Button` primitive update, (4) page-by-page refactor in the order listed in §7. After each page, run the dev server and screenshot it in both light and dark before moving on. Do not introduce new colors beyond the tokens defined in §3. Do not preserve any of the current emerald/amber/yellow/blue badge colors — score colors must be monochrome per §5. When unsure, prefer the simpler, calmer rendering. Read `node_modules/next/dist/docs/` before changing anything Next-API-shaped.

---

Reference mocks: `Rebrand Explorations.html` in this project — section "Hook — High-contrast modern", artboards in both light and dark.
