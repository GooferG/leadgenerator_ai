# SaaS Landing Page Design

**Date:** 2026-05-02  
**Status:** Approved

## Overview

Replace the current minimal `src/app/page.tsx` with a full single-page SaaS marketing site. The page stays in one file (no new component files). Design matches the existing dark theme: `#0a0a0a` background, emerald (`#10b981`) accent, DM Sans + Syne fonts, shadcn/ui + Tailwind v4.

## Section Order

```
Nav → Hero → Screenshot Slider → Features → Testimonials → Pricing → Final CTA → Footer
```

This follows the **Hook → Proof → Convert** pattern: show the product early with screenshots before explaining features, then convert with pricing.

## Sections

### Nav
- Logo (⚡ Lead Scout) left, links right (Features, Pricing anchor links + Sign In CTA button)
- Sticky, dark background, subtle bottom border
- Sign In links to `/login`

### Hero
- Pill badge: "AI-Powered Lead Discovery"
- H1: "Find businesses that need your services" with emerald highlight on second line
- Subheading: one sentence value prop
- Two CTAs: "Get Started Free" (primary, links to `/login`) + "See how it works ↓" (scrolls to screenshots)
- Radial emerald glow at top (matches existing animation style)

### Screenshot Slider
- Section label + heading
- Auto-rotating image carousel: cycles through all 9 screenshots every 3 seconds
- Images stored in `public/images/screenshots/`
- Navigation dots below, active dot wider (pill shape)
- No external carousel library — implemented with `useState` + `useEffect` + `setInterval`
- Images shown with rounded corners, subtle border, slight drop shadow

### Features
- 3-column grid of feature cards
- Features: Smart Search, AI Scoring, Lead Pipeline
- Each card: icon, title, short description
- Dark card background with border

### Testimonials
- 3-column grid
- Placeholder content (star rating, quote, name/role)
- Easy to replace with real quotes later

### Pricing
- 2-column grid: Free tier + Pro tier
- **Free:** $0/mo, active, "Get Started Free" CTA links to `/login`
- **Pro:** TBD/mo, "Coming Soon" badge, disabled button, highlighted border to draw attention
- Feature comparison list in each card (checkmarks + crosses)

### Final CTA
- Bold headline + short subtext
- Single "Get Started — It's Free" button linking to `/login`
- Subtle radial glow at bottom (mirrors hero)

### Footer
- Copyright left, Privacy + Terms links right (placeholder hrefs for now)

## Implementation Details

- **File:** `src/app/page.tsx` — full rewrite, single file
- **Slider state:** `const [current, setCurrent] = useState(0)` + `useEffect` with `setInterval(3000)`
- **Images:** `public/images/screenshots/screenshot-1.png` through `screenshot-9.png`
- **Anchor links:** `#screenshots`, `#features`, `#pricing` IDs on section wrappers
- **No new dependencies**
- **"use client"** directive required for slider useState/useEffect

## Out of Scope

- Blog, docs, or any additional pages
- Real testimonial data (placeholders only)
- Pro tier pricing (shown as TBD / Coming Soon)
- Privacy/Terms pages (links present, pages not built)
