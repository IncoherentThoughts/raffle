// Test-only builders for Entries rows and flag pairs.
import type { AdminEntry, EntryFlag } from '../../../lib/api/entries'

export function entry(over: Partial<AdminEntry> & { id: string; full_name: string }): AdminEntry {
  return {
    raffle_id: 'r1',
    email: `${over.id}@thecomfortgroup.com`,
    email_normalized: `${over.id}@thecomfortgroup.com`,
    device_id: null,
    added_by_admin: false,
    created_at: '2026-10-08T14:00:00Z',
    removed_at: null,
    removed_reason: null,
    eligible: true,
    reason: 'eligible',
    excluding_won_at: null,
    override_reason: null,
    status_source: 'live',
    flags: [],
    is_returning: false,
    ...over,
  }
}

/** Both sides of a pair, as admin_entry_flags returns it. */
export function pair(
  rule: EntryFlag['rule'],
  a: AdminEntry,
  b: AdminEntry,
  { dismissed = false }: { dismissed?: boolean } = {},
): EntryFlag[] {
  return [
    { entry_id: a.id, rule, other_entry_id: b.id, other_full_name: b.full_name, other_removed: !!b.removed_at, dismissed },
    { entry_id: b.id, rule, other_entry_id: a.id, other_full_name: a.full_name, other_removed: !!a.removed_at, dismissed },
  ]
}
