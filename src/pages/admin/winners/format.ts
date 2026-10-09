import type { OverrideKind, WinnerRow } from '../../../lib/api/winners'
import type { Tone } from '../ui'

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** "Aug 19, 2026" */
export function formatDate(iso: string): string {
  return DATE.format(new Date(iso))
}

/**
 * A `<input type="date">` value ("2026-08-19") as the start of that day in local time, ISO.
 * Returns null for an empty or malformed value.
 */
export function localDateToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Today as a `<input type="date">` value, in local time. */
export function todayInputValue(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

export const OVERRIDE_LABEL: Record<OverrideKind, string> = {
  force_eligible: 'Always eligible',
  force_excluded: 'Always excluded',
}

export type StatusView = { label: string; tone: Tone; title?: string }

/**
 * The Status column. Whether a Winner excludes is decided in the database (`excluded`,
 * same rule as the Draw); this only turns it into a label.
 */
export function winnerStatus(w: WinnerRow): StatusView {
  if (w.status === 'replaced') {
    return {
      label: 'Replaced',
      tone: 'neutral',
      title: w.replaced_reason ? `Replaced: ${w.replaced_reason}` : undefined,
    }
  }
  if (w.excluded) {
    return {
      label: `Excluded ${w.window_months} mo`,
      tone: 'gold',
      title: w.excluded_until ? `Excluded from draws until ${formatDate(w.excluded_until)}` : undefined,
    }
  }
  return { label: 'Eligible again', tone: 'green' }
}

/** Hover text for an Override: the reason, plus the expiry when there is one. */
export function overrideTitle(reason: string | null, expiresAt: string | null): string {
  return [reason, expiresAt ? `Expires ${formatDate(expiresAt)}` : null].filter(Boolean).join(' · ')
}

/** Friendly copy for the business errors the Winners RPCs raise. */
export function friendlyError(message: string): string {
  switch (message) {
    case 'invalid_email':
      return 'Enter a valid email address.'
    case 'won_at_in_future':
      return "The won date can't be in the future."
    case 'reason_required':
      return 'Give a reason of at least 3 characters.'
    case 'not_past_winner':
      return 'Only past winners can be deleted; drawn winners change by Redraw.'
    case 'winner_not_found':
      return 'That winner no longer exists. Refresh and try again.'
    case 'override_not_found':
      return 'That override no longer exists. Refresh and try again.'
    case 'override_already_cleared':
      return 'That override was already cleared.'
    case 'invalid_kind':
      return 'Choose Always eligible or Always excluded.'
    default:
      return message
  }
}
