// History tab (#16): completed Raffles, a Raffle's detail and the Activity Log.
// Read-only; every row here was written by an admin RPC.
import { supabase } from '../supabase'
import { unwrap } from './errors'
import type { Row } from './rpc'

export type RaffleRow = Row<'raffles'>
export type WinnerRow = Row<'winners'>
export type SnapshotRow = Row<'draw_snapshots'>
export type SnapshotEntryRow = Row<'draw_snapshot_entries'>
export type ActivityRow = Row<'activity_log'> & {
  /** The Raffle the action belongs to, when it has one. */
  raffles: { title: string; state: RaffleRow['state'] } | null
}

/** One row of the History table: a Drawn or Cancelled Raffle. */
export type HistoryRaffle = {
  id: string
  title: string
  prize: string | null
  state: 'drawn' | 'cancelled'
  openedAt: string
  /** When entries actually stopped: the Close Time, or the cancellation if that came first. */
  closedAt: string
  /** drawn_at or cancelled_at. */
  endedAt: string
  cancelReason: string | null
  winnerCount: number
  /** Every Entry on record, Removed included. */
  entries: number
  /** From the Draw Snapshot; null for a Cancelled Raffle. */
  eligible: number | null
  /** Excluded at the Draw, not counting Removed Entries. */
  excluded: number | null
  /** Entries that were Removed at the Draw; null for a Cancelled Raffle. */
  removed: number | null
  /** Standing Winners. */
  winners: number
  /** Winner Count minus Standing Winners (Drawn only). */
  vacant: number
  /** Number of replacements (Replaced Winners). */
  redraws: number
}

type HistoryQueryRow = RaffleRow & {
  draw_snapshots: (Pick<SnapshotRow, 'eligible_count' | 'excluded_count'> & { removed: { count: number }[] }) | null
  entries: { count: number }[]
  winners: Pick<WinnerRow, 'status'>[]
}

export function toHistoryRaffle(r: HistoryQueryRow): HistoryRaffle {
  const drawn = r.state === 'drawn'
  const standing = r.winners.filter((w) => w.status === 'standing').length
  const endedAt = (drawn ? r.drawn_at : r.cancelled_at) ?? r.close_time
  const snap = r.draw_snapshots
  const removed = snap ? (snap.removed[0]?.count ?? 0) : null
  return {
    id: r.id,
    title: r.title,
    prize: r.prize,
    state: drawn ? 'drawn' : 'cancelled',
    openedAt: r.created_at,
    closedAt: Date.parse(endedAt) < Date.parse(r.close_time) ? endedAt : r.close_time,
    endedAt,
    cancelReason: r.cancel_reason,
    winnerCount: r.winner_count,
    entries: r.entries[0]?.count ?? 0,
    eligible: snap?.eligible_count ?? null,
    excluded: snap ? snap.excluded_count - (removed ?? 0) : null,
    removed,
    winners: standing,
    vacant: drawn ? Math.max(0, r.winner_count - standing) : 0,
    redraws: r.winners.filter((w) => w.status === 'replaced').length,
  }
}

/** Drawn and Cancelled Raffles, newest first. */
export async function listHistory(): Promise<HistoryRaffle[]> {
  const rows = unwrap(
    await supabase
      .from('raffles')
      .select(
        '*, draw_snapshots(eligible_count, excluded_count, removed:draw_snapshot_entries(count)), entries(count), winners(status)',
      )
      .eq('draw_snapshots.removed.reason', 'removed')
      .in('state', ['drawn', 'cancelled'])
      .order('created_at', { ascending: false }),
  ) as unknown as HistoryQueryRow[] | null
  return (rows ?? []).map(toHistoryRaffle)
}

export type RaffleDetail = {
  raffle: RaffleRow
  winners: WinnerRow[]
  snapshot: SnapshotRow | null
  snapshotEntries: SnapshotEntryRow[]
  activity: ActivityRow[]
  /** Every Entry on record, Removed included. */
  entryCount: number
}

const ACTIVITY_SELECT = '*, raffles(title, state)'

/** Everything the Raffle detail page shows. Null when the Raffle doesn't exist. */
export async function getRaffleDetail(raffleId: string): Promise<RaffleDetail | null> {
  const [raffle, winners, snapshot, snapshotEntries, activity, entries] = await Promise.all([
    supabase.from('raffles').select('*').eq('id', raffleId).maybeSingle(),
    supabase.from('winners').select('*').eq('raffle_id', raffleId).order('position').order('won_at'),
    supabase.from('draw_snapshots').select('*').eq('raffle_id', raffleId).maybeSingle(),
    supabase.from('draw_snapshot_entries').select('*').eq('raffle_id', raffleId).order('full_name'),
    supabase
      .from('activity_log')
      .select(ACTIVITY_SELECT)
      .eq('raffle_id', raffleId)
      .order('at', { ascending: false })
      .order('id', { ascending: false }),
    supabase.from('entries').select('id', { count: 'exact', head: true }).eq('raffle_id', raffleId),
  ])
  const r = unwrap(raffle) as RaffleRow | null
  if (!r) return null
  unwrap(entries)
  return {
    raffle: r,
    winners: (unwrap(winners) as WinnerRow[] | null) ?? [],
    snapshot: unwrap(snapshot) as SnapshotRow | null,
    snapshotEntries: (unwrap(snapshotEntries) as SnapshotEntryRow[] | null) ?? [],
    activity: (unwrap(activity) as unknown as ActivityRow[] | null) ?? [],
    entryCount: (entries as { count?: number | null }).count ?? 0,
  }
}

/** The full Activity Log, newest first. Asks for one extra row to tell whether more exist. */
export async function listActivity(limit: number): Promise<{ rows: ActivityRow[]; more: boolean }> {
  const rows =
    (unwrap(
      await supabase
        .from('activity_log')
        .select(ACTIVITY_SELECT)
        .order('at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1),
    ) as unknown as ActivityRow[] | null) ?? []
  return { rows: rows.slice(0, limit), more: rows.length > limit }
}
