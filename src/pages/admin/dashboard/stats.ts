/** The fields of an `admin_entries` row the Dashboard stats need. */
export type StatsEntry = {
  created_at: string
  removed_at: string | null
  eligible: boolean
  flags: string[]
  is_returning: boolean
}

export type DayCount = { day: string; count: number }

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
  /** Non-removed Entries per local day, Opened through Close Time. */
  daily: DayCount[]
}

/** Local calendar day as YYYY-MM-DD. */
export function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** At most this many bars; a longer Raffle shows its last MAX_DAYS days. */
const MAX_DAYS = 120

export function raffleStats(
  raffle: { created_at: string; close_time: string },
  rows: StatsEntry[],
): RaffleStats {
  const live = rows.filter((e) => !e.removed_at)
  const eligible = live.filter((e) => e.eligible).length
  const returning = live.filter((e) => e.is_returning).length

  const counts = new Map<string, number>()
  for (const e of live) {
    const day = localDay(new Date(e.created_at))
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  const days: DayCount[] = []
  const start = new Date(raffle.created_at)
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = localDay(new Date(Math.max(new Date(raffle.close_time).getTime(), start.getTime())))
  for (;;) {
    const day = localDay(cursor)
    days.push({ day, count: counts.get(day) ?? 0 })
    if (day >= last) break
    cursor.setDate(cursor.getDate() + 1)
  }

  return {
    entries: live.length,
    eligible,
    excluded: live.length - eligible,
    flags: rows.filter((e) => e.flags.length > 0).length,
    new: live.length - returning,
    returning,
    daily: days.slice(-MAX_DAYS),
  }
}
