// Pure view logic for the Entries tab: flag pills, status labels, filters, search, CSV.
// The flag rules themselves are computed in SQL (private.flag_pairs, pgTAP-tested in
// supabase/tests/04_entries_flags_test.sql and 14_flag_rules_test.sql).
import type { AdminEntry, EntryFlag, FlagRule } from '../../../lib/api/entries'

export const RULE_ORDER: FlagRule[] = ['same_name', 'email_match', 'same_device']
export const RULE_LABEL: Record<FlagRule, string> = {
  same_name: 'same name',
  email_match: 'email match',
  same_device: 'same device',
}

export type FlagPair = { otherId: string; otherName: string; otherEmail: string; otherRemoved: boolean }

/**
 * One pill per rule with at least one undismissed pair. `active` (red) while any other Entry
 * of the pair is still in; `pair-removed` (grey) when every other Entry is removed.
 */
export type FlagPill = {
  rule: FlagRule
  label: string
  state: 'active' | 'pair-removed'
  /** Hover text naming the other Entry(s). */
  title: string
  /** Undismissed pairs for this rule (what Dismiss acts on). */
  pairs: FlagPair[]
}

export type DismissedMarker = { rule: FlagRule; label: string; otherName: string }

export type Tone = 'green' | 'gold' | 'red'
export type StatusLabel = { label: string; tone: Tone; title?: string }

export type EntryRow = {
  entry: AdminEntry
  pills: FlagPill[]
  dismissed: DismissedMarker[]
  /** At least one undismissed Duplicate Flag (counts toward the Flags stat). */
  flagged: boolean
  /** Any flag, dismissed or not (the Flagged filter). */
  everFlagged: boolean
  removed: boolean
  status: StatusLabel
}

export type EntriesFilter = 'all' | 'flagged' | 'removed' | 'excluded'

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

/** Status column: live preview before the Draw, Snapshot verdict after (same wording). */
export function statusLabel(e: AdminEntry): StatusLabel {
  switch (e.reason) {
    case 'removed':
      return { label: 'Removed', tone: 'red', title: e.removed_reason ?? undefined }
    case 'exclusion_window':
      return { label: e.excluding_won_at ? `Excluded: won ${formatDate(e.excluding_won_at)}` : 'Excluded: past winner', tone: 'gold' }
    case 'override_excluded':
      return { label: 'Override: always excluded', tone: 'gold', title: e.override_reason ?? undefined }
    case 'override_eligible':
      return { label: 'Override: always eligible', tone: 'green', title: e.override_reason ?? undefined }
    default:
      return { label: 'Eligible', tone: 'green' }
  }
}

/** Join each Entry with its side of the flagged pairs. Keeps the Entries' order. */
export function buildRows(entries: AdminEntry[], flags: EntryFlag[]): EntryRow[] {
  const emailOf = new Map(entries.map((e) => [e.id, e.email]))
  const byEntry = new Map<string, EntryFlag[]>()
  for (const f of flags) {
    const list = byEntry.get(f.entry_id) ?? []
    list.push(f)
    byEntry.set(f.entry_id, list)
  }
  return entries.map((entry) => {
    const mine = byEntry.get(entry.id) ?? []
    const pills: FlagPill[] = []
    const dismissed: DismissedMarker[] = []
    for (const rule of RULE_ORDER) {
      const ofRule = mine.filter((f) => f.rule === rule)
      for (const f of ofRule.filter((x) => x.dismissed)) {
        dismissed.push({ rule, label: RULE_LABEL[rule], otherName: f.other_full_name })
      }
      const open = ofRule.filter((x) => !x.dismissed)
      if (open.length === 0) continue
      const allRemoved = open.every((x) => x.other_removed)
      const names = open.map((x) => x.other_full_name).join(', ')
      pills.push({
        rule,
        label: RULE_LABEL[rule],
        state: allRemoved ? 'pair-removed' : 'active',
        title: `${capitalize(RULE_LABEL[rule])} as ${names}${allRemoved ? ' (pair removed)' : ''}`,
        pairs: open.map((x) => ({
          otherId: x.other_entry_id,
          otherName: x.other_full_name,
          otherEmail: emailOf.get(x.other_entry_id) ?? '',
          otherRemoved: x.other_removed,
        })),
      })
    }
    return {
      entry,
      pills,
      dismissed,
      flagged: pills.length > 0,
      everFlagged: pills.length > 0 || dismissed.length > 0,
      removed: entry.removed_at !== null,
      status: statusLabel(entry),
    }
  })
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export function filterRows(rows: EntryRow[], filter: EntriesFilter, query: string): EntryRow[] {
  const q = fold(query.trim())
  return rows.filter((r) => {
    if (filter === 'flagged' && !r.everFlagged) return false
    if (filter === 'removed' && !r.removed) return false
    if (filter === 'excluded' && (r.removed || r.entry.eligible)) return false
    if (!q) return true
    return fold(r.entry.full_name).includes(q) || fold(r.entry.email).includes(q)
  })
}

export function filterCounts(rows: EntryRow[]): Record<EntriesFilter, number> {
  return {
    all: rows.length,
    flagged: rows.filter((r) => r.everFlagged).length,
    removed: rows.filter((r) => r.removed).length,
    excluded: rows.filter((r) => !r.removed && !r.entry.eligible).length,
  }
}

export const CSV_COLUMNS = ['name', 'email', 'entered_at', 'status', 'flags', 'removed_at', 'removed_reason', 'device_id'] as const

function csvCell(value: string | null): string {
  let v = value ?? ''
  // Spreadsheet formula injection: a leading = + - @ (or tab/CR) would run as a formula.
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`
  return /[",\r\n]/.test(v) || v !== v.trim() || v.startsWith("'") ? `"${v.replace(/"/g, '""')}"` : v
}

/** CSV of the given rows (the current filtered view). Flags = undismissed rule names. */
export function toCsv(rows: EntryRow[]): string {
  const lines = [CSV_COLUMNS.join(',')]
  for (const { entry: e, status } of rows) {
    lines.push(
      [
        e.full_name, e.email, e.created_at, status.label, e.flags.join(';'),
        e.removed_at, e.removed_reason, e.device_id,
      ].map(csvCell).join(','),
    )
  }
  return lines.join('\r\n') + '\r\n'
}
