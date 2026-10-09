import { isApiError } from '../../../lib/api'

/** "Fri, Nov 13, 5:00 PM" (adds the year when it isn't this year). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** "Nov 13, 2026" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "Oct 3" for a YYYY-MM-DD local day. */
export function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** ISO timestamp -> value for <input type="datetime-local"> in local time. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** <input type="datetime-local"> value (local time) -> Date, or null when empty/invalid. */
export function fromLocalInput(value: string): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const FRIENDLY: Record<string, string> = {
  raffle_already_open: 'Another raffle is already open. Draw or cancel it first.',
  close_time_in_past: 'Close Time must be in the future.',
  raffle_not_open: 'This raffle is no longer open or closed; reload to see its current state.',
  raffle_not_editable: 'Only Open or Closed raffles can be edited.',
  raffle_already_closed: 'Entries are already closed.',
  raffle_not_closed: "Entries haven't closed yet.",
  no_eligible_entries: 'There are no eligible entries to draw from.',
  winner_not_standing: 'This winner was already replaced; reload to see the current winners.',
  reason_required: 'A reason of at least 3 characters is required.',
}

/** Friendly copy for a business error from the dashboard RPCs. */
export function friendlyError(e: unknown): string {
  const msg = isApiError(e) || e instanceof Error ? e.message : String(e)
  if (FRIENDLY[msg]) return FRIENDLY[msg]
  if (/check constraint/i.test(msg)) return 'One of the values is out of range.'
  return msg
}
