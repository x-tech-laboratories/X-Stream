import { compact_count } from '@x-tech-laboratories/x-libs/web/format'

// A view count in a few characters, such as "1.4M views", for when YouTube gives only the number.
export function formatViews(count: number): string {
  if (!Number.isFinite(count) || count < 0) return ''
  return `${compact_count(count)} ${count === 1 ? 'view' : 'views'}`
}

/**
 * Turns a view-count label back into a number for sorting, e.g. "1.4M views"
 * → 1_400_000 and "128,231 views" → 128_231.
 *
 * YouTube only gives us the rendered string, so this is approximate for
 * abbreviated values — good enough to order by, not to display. Returns -1 for
 * anything unparseable (live "watching" counts, missing data) so those sort
 * last rather than jumping to the top.
 */
export function parseViewCount(text?: string): number {
  if (!text) return -1
  const match = text.replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i)
  if (!match) return -1
  const value = parseFloat(match[1])
  if (!Number.isFinite(value)) return -1
  const multiplier = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }[
    match[2]?.toLowerCase() ?? ''
  ] ?? 1
  return Math.round(value * multiplier)
}

const RELATIVE_UNIT_MS: Record<string, number> = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_629_800_000,  // average Gregorian month
  year: 31_557_600_000,
}

/**
 * Converts a relative upload label — "2 weeks ago", "1 month ago" — into
 * approximate milliseconds of age, for sorting by recency.
 *
 * Live streams ("Streamed 2 years ago") are handled by ignoring the prefix.
 * Returns Infinity when nothing parses, so unknown dates sort oldest.
 */
export function parseRelativeAge(text?: string): number {
  if (!text) return Infinity
  const match = text.match(/(\d+)\s*(second|minute|hour|day|week|month|year)/i)
  if (!match) return Infinity
  const unit = RELATIVE_UNIT_MS[match[2].toLowerCase()]
  return unit ? parseInt(match[1], 10) * unit : Infinity
}
