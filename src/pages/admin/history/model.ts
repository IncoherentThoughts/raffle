// Pure helpers for the History pages: Winner slots with their Redraw chain, readable
// Activity Log lines, verdict labels and date formatting.
import type { ActivityRow, SnapshotEntryRow, WinnerRow } from '../../../lib/api/history'

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export const formatDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : '—')
export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTimeFmt.format(new Date(iso)) : '—')

// ---------------------------------------------------------------------------
// Winner slots
// ---------------------------------------------------------------------------
export type Slot = {
  position: number
  /** Every Winner who held this slot, in order: the Draw's pick, then each Redraw's alternate. */
  chain: WinnerRow[]
  /** The Standing Winner, if the slot is filled. */
  standing: WinnerRow | null
  /**
   * Why a slot is empty: 'unfilled' when the Draw had fewer Eligible Entries than slots,
   * 'no_alternates' when a Redraw found no one left in the Snapshot.
   */
  vacancy: 'unfilled' | 'no_alternates' | null
}

export function winnerSlots(winnerCount: number, winners: WinnerRow[]): Slot[] {
  const slots: Slot[] = []
  for (let position = 1; position <= winnerCount; position++) {
    const chain = winners
      .filter((w) => w.position === position)
      .sort((a, b) => a.won_at.localeCompare(b.won_at) || (a.source === 'draw' ? -1 : 1))
    const standing = chain.find((w) => w.status === 'standing') ?? null
    slots.push({
      position,
      chain,
      standing,
      vacancy: standing ? null : chain.length === 0 ? 'unfilled' : 'no_alternates',
    })
  }
  return slots
}

// ---------------------------------------------------------------------------
// Draw Snapshot verdicts and frozen Duplicate Flags
// ---------------------------------------------------------------------------
export const FLAG_LABELS: Record<string, string> = {
  same_name: 'same name',
  email_match: 'email match',
  same_device: 'same device',
}

export function verdictLabel(e: SnapshotEntryRow): string {
  switch (e.reason) {
    case 'eligible':
      return 'Eligible'
    case 'override_eligible':
      return `Eligible (override${e.override_reason ? `: ${e.override_reason}` : ''})`
    case 'override_excluded':
      return `Excluded (override${e.override_reason ? `: ${e.override_reason}` : ''})`
    case 'exclusion_window':
      return `Excluded: won ${formatDate(e.excluding_won_at)}`
    case 'removed':
      return 'Excluded: removed'
  }
}

// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------
type Details = Record<string, unknown>

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const EDIT_FIELDS: [string, string][] = [
  ['title', 'title'],
  ['prize', 'prize'],
  ['details', 'details'],
  ['close_time', 'Close Time'],
  ['winner_count', 'Winner Count'],
  ['exclusion_enabled', 'Exclusion Window'],
  ['exclusion_months', 'Exclusion Window months'],
]

function describeEdit(d: Details): string {
  const before = (d.before ?? {}) as Details
  const after = (d.after ?? {}) as Details
  const changed = EDIT_FIELDS.filter(([k]) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).map(
    ([, label]) => label,
  )
  const lead = d.reopened ? 'Reopened the raffle' : d.closed_early ? 'Closed entries early' : 'Edited the raffle'
  return changed.length ? `${lead}: changed ${changed.join(', ')}` : lead
}

/** One readable sentence for an Activity Log row (the "Action" column). */
export function describeActivity(row: Pick<ActivityRow, 'action' | 'details'>): string {
  const d = (row.details ?? {}) as Details
  switch (row.action) {
    case 'raffle_create': {
      const n = Number(d.winner_count ?? 1)
      return `Created the raffle (${plural(n, 'winner')}, closes ${formatDateTime(str(d.close_time) || null)})`
    }
    case 'raffle_edit':
      return describeEdit(d)
    case 'raffle_close_early':
      return 'Closed entries early'
    case 'raffle_cancel':
      return 'Cancelled the raffle'
    case 'draw': {
      const picked = Array.isArray(d.winners) ? (d.winners as Details[]) : []
      const slots = Number(d.winner_count ?? picked.length)
      const names = picked.map((w) => str(w.name)).filter(Boolean)
      let s = `Drew ${plural(picked.length, 'winner')} from ${plural(Number(d.eligible ?? 0), 'eligible entry', 'eligible entries')}`
      if (names.length) s += `: ${names.join(', ')}`
      if (slots > picked.length) s += `; ${plural(slots - picked.length, 'slot')} left vacant`
      return s
    }
    case 'redraw': {
      const slot = d.position != null ? ` slot ${str(d.position)}` : ''
      if (d.vacant) return `Redrew${slot}: replaced ${str(d.replaced_name)}; no eligible alternates, slot left vacant`
      return `Redrew${slot}: replaced ${str(d.replaced_name)} with ${str(d.new_name)}`
    }
    case 'entry_add':
      return 'Added an entry by hand'
    case 'entry_remove':
      return 'Removed an entry'
    case 'entry_restore':
      return 'Restored a removed entry'
    case 'past_winner_add':
      return `Added a past winner (won ${formatDate(str(d.won_at) || null)})`
    case 'past_winner_delete':
      return 'Deleted a past winner'
    case 'override_set': {
      const kind = d.kind === 'force_eligible' ? 'always eligible' : 'always excluded'
      const until = d.expires_at ? ` until ${formatDate(str(d.expires_at))}` : ''
      return `Set an override: ${kind}${until}`
    }
    case 'override_clear':
      return `Cleared an override (${d.kind === 'force_eligible' ? 'always eligible' : 'always excluded'})`
    case 'flag_dismiss':
      return `Dismissed a "${FLAG_LABELS[str(d.rule)] ?? str(d.rule)}" flag`
    default:
      return row.action.replace(/_/g, ' ')
  }
}
