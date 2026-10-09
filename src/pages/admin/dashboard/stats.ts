/** The fields of an `admin_entries` row the Dashboard stats need. */
export type StatsEntry = {
  created_at: string
  removed_at: string | null
  eligible: boolean
  flags: string[]
  is_returning: boolean
}

export type RaffleStats = {
  /** Non-removed Entries. */
  entries: number
  /** Non-removed Entries eligible (live preview before the Draw, Snapshot after). */
  eligible: number
  /** Non-removed Entries excluded by the Exclusion Window or an Override. */
  excluded: number
  /** Entries (removed included, #7) with at least one undismissed Duplicate Flag. */
  flags: number
  /** Non-removed Entries whose Entrant has no Entry in an earlier Raffle. */
  new: number
  /** Non-removed Entries whose Entrant has an Entry in an earlier Raffle (Cancelled included). */
  returning: number
}

export function raffleStats(rows: StatsEntry[]): RaffleStats {
  const live = rows.filter((e) => !e.removed_at)
  const eligible = live.filter((e) => e.eligible).length
  const returning = live.filter((e) => e.is_returning).length

  return {
    entries: live.length,
    eligible,
    excluded: live.length - eligible,
    flags: rows.filter((e) => e.flags.length > 0).length,
    new: live.length - returning,
    returning,
  }
}
