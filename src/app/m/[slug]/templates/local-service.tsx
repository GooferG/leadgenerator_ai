// Single-template mockup for local-service businesses (roofers, dentists, salons, etc.).
// Renders defensively against missing fields. Tier 2 variation: typography pair,
// hero layout, CTA placement, and palette swap based on enrichment data.

import type { MockupProps } from '@/lib/schemas'
import { resolvePalette, resolveTypography } from '@/lib/palette'

interface Props {
  props: MockupProps
}

// Derive 3 short value-prop pillars from Claude's `tone` description.
// Keyword-matched against common contractor-voice tokens; falls back to a
// generic-but-not-saccharine trio. Defined at module top-level so the JSX
// inside LocalServiceTemplate can reference it without bundler chunk-split issues.
type PillarItem = { title: string; body: string }

const PILLAR_BANK: Array<{ match: RegExp; pillar: PillarItem }> = [
  { match: /no jargon|plain[- ]spoken|straight[- ]talking|no corporate|no fluff/i,
    pillar: { title: 'Plain talk', body: 'No jargon. We tell you what the job is, what it costs, and when we can be there.' } },
  { match: /no runaround|on time|shows up|reliable|dependable/i,
    pillar: { title: 'We show up', body: 'Booked an estimate at 2pm? We are there at 2pm. No vanishing crews.' } },
  { match: /local|neighborhood|community|hometown/i,
    pillar: { title: 'Local crews', body: 'Our team lives here. We know which roofs handle the heat and which do not.' } },
  { match: /licensed|insured|bonded|warranty|guarantee/i,
    pillar: { title: 'Backed work', body: 'Licensed, insured, and we stand behind every install. Get it in writing.' } },
  { match: /fast|quick|same[- ]day|emergency|urgent/i,
    pillar: { title: 'Fast response', body: 'Most quotes go out within 24 hours. Emergencies move to the front of the line.' } },
  { match: /trust|honest|transparent|no surprise/i,
    pillar: { title: 'Honest quotes', body: 'One price, in writing, before any work starts. No surprise line items at the end.' } },
  { match: /experienced|veteran|years|seasoned|trade/i,
    pillar: { title: 'Experienced hands', body: 'Decades of work in this market. We have seen what fails and how to fix it.' } },
  { match: /confident|no overselling|no pressure/i,
    pillar: { title: 'No pressure', body: 'We quote it once, then leave you alone. No follow-up calls every day after.' } },
  { match: /contractor|trade|hands[- ]on/i,
    pillar: { title: 'Trade-built', body: 'Run by a contractor, not a marketing team. The person who quotes is the person on the roof.' } },
]

function derivePillars(tone: string | undefined): PillarItem[] {
  const matched: PillarItem[] = []
  const seen = new Set<string>()
  for (const { match, pillar } of PILLAR_BANK) {
    if (match.test(tone ?? '') && !seen.has(pillar.title)) {
      matched.push(pillar)
      seen.add(pillar.title)
      if (matched.length === 3) break
    }
  }
  const fallbacks: PillarItem[] = [
    { title: 'Local crews', body: 'Our team lives here. We know which roofs handle the heat and which do not.' },
    { title: 'Plain talk', body: 'No jargon. We tell you what the job is, what it costs, and when we can be there.' },
    { title: 'We show up', body: 'Booked an estimate at 2pm? We are there at 2pm. No vanishing crews.' },
  ]
  for (const f of fallbacks) {
    if (matched.length === 3) break
    if (!seen.has(f.title)) {
      matched.push(f)
      seen.add(f.title)
    }
  }
  return matched
}

export function LocalServiceTemplate({ props }: Props) {
  // Use business_name as the variation seed — stable per lead, so the same lead
  // always renders the same palette + layout across reloads, but different leads
  // in the same niche/region get visibly different output.
  const seed = props.business_name
  const palette = resolvePalette(props.palette, seed)
  const typography = resolveTypography(props.tone, props.design_choice, seed)

  const headingFontClass =
    typography.headingFont === 'serif' ? 'font-serif' : 'font-sans'
  const heroIsSplit = typography.layoutVariant === 'split'

  return (
    <div
      style={{
        backgroundColor: palette.bg,
        color: palette.fg,
        fontFamily:
          typography.headingFont === 'serif'
            ? 'Georgia, "Times New Roman", serif'
            : 'system-ui, -apple-system, sans-serif',
      }}
      className="min-h-screen"
    >
      {/* Top wordmark strip */}
      <header
        className="border-b"
        style={{ borderColor: palette.border }}
      >
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className={`${headingFontClass} text-lg font-semibold tracking-tight`}>
            {props.business_name}
          </div>
          {props.business_phone && (
            <a
              href={`tel:${props.business_phone}`}
              className="text-sm font-medium hover:opacity-70 transition-opacity"
              style={{ color: palette.fg }}
            >
              {props.business_phone}
            </a>
          )}
        </div>
      </header>

      {/* HERO */}
      <section className="border-b" style={{ borderColor: palette.border }}>
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          {heroIsSplit ? (
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <HeroText props={props} palette={palette} headingFontClass={headingFontClass} typography={typography} />
              </div>
              <HeroImage palette={palette} />
            </div>
          ) : (
            <div className="max-w-3xl">
              <HeroText props={props} palette={palette} headingFontClass={headingFontClass} typography={typography} />
            </div>
          )}
        </div>
      </section>

      {/* SERVICES */}
      {props.services.length > 0 && (
        <section
          className="border-b"
          style={{ borderColor: palette.border, backgroundColor: palette.surface }}
        >
          <div className="max-w-6xl mx-auto px-6 py-20">
            <p
              className="text-xs font-mono uppercase tracking-[0.12em] mb-3"
              style={{ color: palette.muted }}
            >
              What we do
            </p>
            <h2
              className={`${headingFontClass} text-3xl md:text-4xl font-semibold mb-12 max-w-2xl`}
              style={{ letterSpacing: '-0.02em' }}
            >
              Services
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {props.services.map((service, i) => (
                <div
                  key={i}
                  className="border-l-2 pl-5 py-1"
                  style={{ borderColor: palette.accent }}
                >
                  <h3 className={`${headingFontClass} text-lg font-medium`}>
                    {service}
                  </h3>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* WHY US strip — content derived from `tone` keywords so each lead's
          three-pillar block reflects what Claude actually said about their voice. */}
      <section className="border-b" style={{ borderColor: palette.border }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-3 gap-10">
            {derivePillars(props.tone).map((p) => (
              <Pillar
                key={p.title}
                title={p.title}
                body={p.body}
                palette={palette}
                headingFontClass={headingFontClass}
              />
            ))}
          </div>
        </div>
      </section>

      {/* WHAT WE'D FIX — opt-in section, only renders when site_audit findings exist
          and the audit isn't a no-website placeholder. Phase 3.5 surface for the
          "before/after" angle that makes mockups feel custom. */}
      {props.site_audit &&
        props.site_audit.length > 0 &&
        !props.site_audit.some((s) => /no website|chain location/i.test(s)) && (
        <section
          className="border-b"
          style={{ borderColor: palette.border, backgroundColor: palette.surface }}
        >
          <div className="max-w-6xl mx-auto px-6 py-20">
            <p
              className="text-xs font-mono uppercase tracking-[0.12em] mb-3"
              style={{ color: palette.muted }}
            >
              What we&rsquo;d fix
            </p>
            <h2
              className={`${headingFontClass} text-3xl md:text-4xl font-semibold mb-10 max-w-2xl`}
              style={{ letterSpacing: '-0.02em' }}
            >
              Where the current site falls short
            </h2>
            <ul className="space-y-4 max-w-3xl">
              {props.site_audit.map((finding, i) => (
                <li key={i} className="flex gap-4">
                  <span
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-mono mt-0.5"
                    style={{
                      backgroundColor: palette.accent,
                      color: palette.accentFg,
                    }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-base leading-relaxed" style={{ color: palette.fg }}>
                    {finding}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* CONTACT */}
      <section style={{ backgroundColor: palette.surface }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-2 gap-10 items-start">
            <div>
              <p
                className="text-xs font-mono uppercase tracking-[0.12em] mb-3"
                style={{ color: palette.muted }}
              >
                Get in touch
              </p>
              <h2
                className={`${headingFontClass} text-3xl md:text-4xl font-semibold mb-6 max-w-md`}
                style={{ letterSpacing: '-0.02em' }}
              >
                {props.cta_copy}
              </h2>
              {props.business_phone && (
                <a
                  href={`tel:${props.business_phone}`}
                  className="inline-block px-6 py-3 rounded-full font-medium text-sm transition-opacity hover:opacity-90"
                  style={{ backgroundColor: palette.accent, color: palette.accentFg }}
                >
                  Call {props.business_phone}
                </a>
              )}
            </div>
            <div className="text-sm leading-relaxed" style={{ color: palette.muted }}>
              {props.business_address && (
                <p className="mb-2">
                  <span style={{ color: palette.fg, fontWeight: 500 }}>Address: </span>
                  {props.business_address}
                </p>
              )}
              {props.business_phone && (
                <p>
                  <span style={{ color: palette.fg, fontWeight: 500 }}>Phone: </span>
                  {props.business_phone}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Sticky CTA bar — only on contractor-direct tones */}
      {typography.ctaPlacement === 'sticky-bar' && props.business_phone && (
        <div
          className="fixed bottom-0 left-0 right-0 border-t z-50"
          style={{ backgroundColor: palette.surface, borderColor: palette.border }}
        >
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <span className="text-sm font-medium hidden sm:block">
              {props.cta_copy}
            </span>
            <a
              href={`tel:${props.business_phone}`}
              className="px-5 py-2 rounded-full font-medium text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: palette.accent, color: palette.accentFg }}
            >
              Call now
            </a>
          </div>
        </div>
      )}

      <footer className="border-t" style={{ borderColor: palette.border }}>
        <div className="max-w-6xl mx-auto px-6 py-6">
          <p className="text-xs" style={{ color: palette.muted }}>
            © {new Date().getFullYear()} {props.business_name}
          </p>
        </div>
      </footer>
    </div>
  )
}

function HeroText({
  props,
  palette,
  headingFontClass,
  typography,
}: {
  props: MockupProps
  palette: ReturnType<typeof resolvePalette>
  headingFontClass: string
  typography: ReturnType<typeof resolveTypography>
}) {
  const ctaClass =
    typography.ctaPlacement === 'hero-stacked' ? 'block' : 'inline-block'

  return (
    <>
      <p
        className="text-xs font-mono uppercase tracking-[0.12em] mb-4"
        style={{ color: palette.muted }}
      >
        {props.business_name}
      </p>
      <h1
        className={`${headingFontClass} text-5xl md:text-6xl font-semibold mb-6 leading-[1.05]`}
        style={{ letterSpacing: '-0.03em' }}
      >
        {props.hero_angle || props.business_name}
      </h1>
      {props.business_phone && typography.ctaPlacement !== 'sticky-bar' && (
        <a
          href={`tel:${props.business_phone}`}
          className={`${ctaClass} px-6 py-3 rounded-full font-medium text-sm transition-opacity hover:opacity-90`}
          style={{ backgroundColor: palette.accent, color: palette.accentFg }}
        >
          {props.cta_copy}
        </a>
      )}
    </>
  )
}

function HeroImage({ palette }: { palette: ReturnType<typeof resolvePalette> }) {
  // Placeholder for v1 — gradient block. Phase 2.5 swaps in real photography.
  return (
    <div
      className="aspect-[4/5] rounded-3xl"
      style={{
        background: `linear-gradient(135deg, ${palette.accent} 0%, ${palette.surface} 100%)`,
      }}
    />
  )
}

function Pillar({
  title,
  body,
  palette,
  headingFontClass,
}: {
  title: string
  body: string
  palette: ReturnType<typeof resolvePalette>
  headingFontClass: string
}) {
  return (
    <div>
      <h3 className={`${headingFontClass} text-xl font-semibold mb-2`}>{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: palette.muted }}>
        {body}
      </p>
    </div>
  )
}
