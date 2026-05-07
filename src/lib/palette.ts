// Parse a free-text palette string from `enrichments.site_brief.palette`
// into structured Tailwind-friendly CSS variables for the mockup template.
//
// The site_brief.palette field is a sentence Claude writes, e.g.:
//   "deep slate blue, rust orange, warm neutral"
//   "monochrome charcoal with a single accent in muted gold"
//   "earthy beige and burnt umber, photography-led"
//
// We do simple keyword matching to pick a CSS variable set. This is intentionally
// dumb — bad matches fall back to a neutral palette rather than failing.
//
// IMPORTANT: order of checks matters. We look for ACCENT colors first, then
// dominant body colors. Reason: most palette strings list multiple colors
// (e.g. "charcoal + burnt orange + off-white") where the body is dark text on
// light bg with a warm accent. If we matched on the body color first, every
// "charcoal + ..." palette would render dark, even when the design is clearly
// meant to be a light page with an orange CTA.

export interface Palette {
  bg: string          // page background
  fg: string          // primary text
  muted: string       // secondary text
  surface: string     // cards / sections
  border: string      // hairlines
  accent: string      // CTA + highlight
  accentFg: string    // text on accent backgrounds
}

const NEUTRAL: Palette = {
  bg: '#fafaf8',
  fg: '#1a1a1a',
  muted: '#666',
  surface: '#ffffff',
  border: '#e5e5e2',
  accent: '#1a1a1a',
  accentFg: '#fafaf8',
}

const SLATE_BLUE: Palette = {
  bg: '#f5f6f8',
  fg: '#0f172a',
  muted: '#475569',
  surface: '#ffffff',
  border: '#cbd5e1',
  accent: '#1e3a5f',
  accentFg: '#ffffff',
}

const RUST_WARM: Palette = {
  bg: '#faf6f1',
  fg: '#2d1810',
  muted: '#7a6857',
  surface: '#ffffff',
  border: '#e8dcc8',
  accent: '#a04020',
  accentFg: '#fef9f3',
}

const DESERT: Palette = {
  bg: '#fbf6ee',
  fg: '#3a2a1a',
  muted: '#8a6e4c',
  surface: '#ffffff',
  border: '#e6d8c0',
  accent: '#c4541f',
  accentFg: '#fbf6ee',
}

const FOREST: Palette = {
  bg: '#f5f7f4',
  fg: '#0f1f15',
  muted: '#4a5d4f',
  surface: '#ffffff',
  border: '#cbd7cc',
  accent: '#2d5a3f',
  accentFg: '#f5f7f4',
}

const MONO_GOLD: Palette = {
  bg: '#f7f6f2',
  fg: '#171717',
  muted: '#525252',
  surface: '#ffffff',
  border: '#d4d4d4',
  accent: '#a48536',
  accentFg: '#1a1a1a',
}

const CHARCOAL: Palette = {
  bg: '#1a1a1a',
  fg: '#f5f5f5',
  muted: '#a3a3a3',
  surface: '#262626',
  border: '#404040',
  accent: '#f5f5f5',
  accentFg: '#1a1a1a',
}

const CLAY_RED: Palette = {
  bg: '#faf5f0',
  fg: '#2a1410',
  muted: '#7a5a52',
  surface: '#ffffff',
  border: '#e8d5cc',
  accent: '#a8392a',
  accentFg: '#faf5f0',
}

// Resolution order:
//   1. UNAMBIGUOUS keyword wins (e.g. "navy", "forest", "dark mode"). These are
//      cases where Claude clearly chose a specific direction, so we honor it.
//   2. AMBIGUOUS palette (the typical "warm + earth + accent" Phoenix-area roofer
//      output, where every lead in a niche/region collapses to the same concept):
//      hash the seed string and rotate among warm-family palettes. This breaks
//      the LLM's batch-uniformity without ignoring its signal entirely.
//
// `seed` (optional) is a stable per-lead string (e.g. lead.id or business_name)
// so the same lead always renders with the same palette across reloads.
export function resolvePalette(input: string | undefined | null, seed?: string): Palette {
  if (!input) return NEUTRAL
  const s = input.toLowerCase()

  // --- Unambiguous matches (LLM signal honored verbatim) ---

  // True dark mode — only when the palette explicitly indicates a dark page background.
  if (
    s.includes('dark mode') ||
    s.includes('dark background') ||
    s.includes('moody dark') ||
    (s.includes('monochrome') && s.includes('charcoal') && !s.includes('off-white') && !s.includes('cream'))
  ) {
    return CHARCOAL
  }

  // Cool/blue family — only when no warm accent overrides.
  if (
    s.includes('navy') ||
    (s.includes('slate') && !s.includes('orange') && !s.includes('warm') && !s.includes('rust') && !s.includes('clay')) ||
    (s.includes('blue') && !s.includes('teal') && !s.includes('orange') && !s.includes('warm'))
  ) {
    return SLATE_BLUE
  }

  // Forest / green
  if (s.includes('forest') || (s.includes('green') && !s.includes('orange')) || s.includes('moss') || s.includes('sage')) {
    return FOREST
  }

  // Gold / brass accents
  if ((s.includes('gold') || s.includes('brass')) && !s.includes('orange') && !s.includes('rust')) {
    return MONO_GOLD
  }

  // --- Ambiguous "warm earth + accent" family ---
  //
  // If we made it here, the palette is most likely some flavor of
  // charcoal/slate + burnt orange/adobe/clay + off-white. Every lead in a
  // warm-region niche tends to collapse to this. Rotate via hashed seed so
  // 10 leads in the same area get visibly different palettes.
  const warmFamily = [DESERT, RUST_WARM, CLAY_RED, NEUTRAL, MONO_GOLD]

  if (seed) {
    return warmFamily[hashString(seed) % warmFamily.length]
  }

  // No seed provided — fall back to keyword matching within the warm family.
  if (s.includes('clay') || s.includes('brick') || (s.includes('deep') && s.includes('red'))) {
    return CLAY_RED
  }
  if (s.includes('desert') || s.includes('adobe') || s.includes('terracotta') || s.includes('southwest') || s.includes('arizona') || s.includes('sand')) {
    return DESERT
  }
  if (s.includes('rust') || s.includes('burnt orange') || s.includes('burnt umber') || (s.includes('orange') && (s.includes('off-white') || s.includes('cream') || s.includes('beige')))) {
    return RUST_WARM
  }

  return NEUTRAL
}

// djb2-style string hash. Deterministic, fast, no crypto needed —
// just enough to spread a small set of seeds across N buckets.
function hashString(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

// Pick a typography pair from the `tone` and `design_choice` strings.
// Returns Tailwind class fragments applied to the template root.
export interface Typography {
  headingFont: 'sans' | 'serif'
  layoutVariant: 'centered' | 'split' | 'asymmetric'
  ctaPlacement: 'hero-inline' | 'hero-stacked' | 'sticky-bar'
}

export function resolveTypography(
  tone: string | undefined,
  designChoice: string | undefined,
  seed?: string
): Typography {
  const t = (tone ?? '').toLowerCase()
  const d = (designChoice ?? '').toLowerCase()
  const combined = `${t} ${d}`

  // --- Heading font: keyword-driven (clearer signal than layout) ---
  let headingFont: Typography['headingFont'] = 'sans'
  if (
    combined.includes('serif') ||
    combined.includes('elegant') ||
    combined.includes('refined') ||
    combined.includes('editorial')
  ) {
    headingFont = 'serif'
  } else if (seed) {
    // Seed-driven: ~30% of leads get serif headings even when Claude didn't ask
    // for one. Adds visual variation across a batch without ignoring strong signals.
    if (hashString(seed + 'font') % 10 < 3) headingFont = 'serif'
  }

  // --- Layout: try keywords first, fall back to seed rotation ---
  let layoutVariant: Typography['layoutVariant']
  if (
    combined.includes('photo-led') ||
    combined.includes('photography-led') ||
    combined.includes('image-led') ||
    combined.includes('two-column') ||
    combined.includes('split')
  ) {
    layoutVariant = 'split'
  } else if (combined.includes('full-width') || combined.includes('asymmetric') || combined.includes('editorial')) {
    layoutVariant = 'asymmetric'
  } else if (seed) {
    const layouts: Typography['layoutVariant'][] = ['centered', 'split', 'asymmetric']
    layoutVariant = layouts[hashString(seed + 'layout') % layouts.length]
  } else {
    layoutVariant = 'centered'
  }

  // --- CTA placement: keyword-driven, with split layout forcing stacked ---
  let ctaPlacement: Typography['ctaPlacement'] = 'hero-inline'
  if (combined.includes('sticky') || combined.includes('contractor') || combined.includes('mobile-first')) {
    ctaPlacement = 'sticky-bar'
  } else if (layoutVariant === 'split') {
    ctaPlacement = 'hero-stacked'
  }

  return { headingFont, layoutVariant, ctaPlacement }
}
