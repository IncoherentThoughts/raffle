// Entries tab (#14): one Raffle's Entries with status and Duplicate Flags, and the
// Entry mutations. Conventions: src/pages/admin/README.md.
import { supabase } from '../supabase'
import { unwrap } from './errors'
import { rpc, type Enums, type Functions, type Row } from './rpc'

export type FlagRule = Enums['flag_rule']
export type VerdictReason = Enums['verdict_reason']

/** Derived Raffle status: Closed is an Open Raffle past its Close Time. */
export type RaffleStatus = 'open' | 'closed' | 'drawn' | 'cancelled'

export type EntriesRaffle = Pick<Row<'raffles'>, 'id' | 'title' | 'close_time' | 'created_at' | 'drawn_at'> & {
  status: RaffleStatus
}

type EntryRowRaw = Functions['admin_entries']['Returns'][number]
/** One row of `admin_entries`. The generator marks every column non-null; these can be null. */
export type AdminEntry = Omit<
  EntryRowRaw,
  'device_id' | 'removed_at' | 'removed_reason' | 'excluding_won_at' | 'override_reason' | 'status_source'
> & {
  device_id: string | null
  removed_at: string | null
  removed_reason: string | null
  excluding_won_at: string | null
  override_reason: string | null
  status_source: 'live' | 'snapshot'
}

/** One side of a flagged pair: `entry_id` is flagged for `rule` together with `other_entry_id`. */
export type EntryFlag = Functions['admin_entry_flags']['Returns'][number]

const RAFFLE_COLUMNS = 'id, title, close_time, created_at, drawn_at, state, status'

function toRaffle(row: (Row<'raffles'> & { status: string | null }) | null): EntriesRaffle | null {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    close_time: row.close_time,
    created_at: row.created_at,
    drawn_at: row.drawn_at,
    status: (row.status ?? row.state) as RaffleStatus,
  }
}

/**
 * The Raffle the Entries tab shows: the newest Raffle that is not Cancelled (the Open one
 * if any, else the last Drawn). Cancelled Raffles' Entries open from History.
 */
export async function currentEntriesRaffle(): Promise<EntriesRaffle | null> {
  const row = unwrap(
    await supabase
      .from('raffles')
      .select(RAFFLE_COLUMNS)
      .neq('state', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
  return toRaffle(row as never)
}

/** Any Raffle by id (for /admin/entries/:raffleId), or null if it doesn't exist. */
export async function getEntriesRaffle(raffleId: string): Promise<EntriesRaffle | null> {
  const row = unwrap(await supabase.from('raffles').select(RAFFLE_COLUMNS).eq('id', raffleId).maybeSingle())
  return toRaffle(row as never)
}

export async function listEntries(raffleId: string): Promise<AdminEntry[]> {
  return ((await rpc('admin_entries', { p_raffle_id: raffleId })) ?? []) as AdminEntry[]
}

export async function listEntryFlags(raffleId: string): Promise<EntryFlag[]> {
  return (await rpc('admin_entry_flags', { p_raffle_id: raffleId })) ?? []
}

/**
 * Add an Entry by hand (Open/Closed Raffles only). Throws ApiError `already_entered`, or
 * `already_entered_removed` with the existing Entry id in `details` (offer Restore).
 */
export const addEntry = (raffleId: string, fullName: string, email: string) =>
  rpc('add_entry', { p_raffle_id: raffleId, p_full_name: fullName.trim(), p_email: email.trim() })

export const removeEntry = (entryId: string, reason: string) =>
  rpc('remove_entry', { p_entry_id: entryId, p_reason: reason })

export const restoreEntry = (entryId: string) => rpc('restore_entry', { p_entry_id: entryId })

/** Dismiss one flagged pair for one rule, with a reason (logged). Entry order is free. */
export const dismissFlag = (raffleId: string, rule: FlagRule, entryA: string, entryB: string, reason: string) =>
  rpc('dismiss_flag', { p_raffle_id: raffleId, p_rule: rule, p_entry_a: entryA, p_entry_b: entryB, p_reason: reason })

/** The public entry page's URL, e.g. https://incoherentthoughts.github.io/raffle/ */
export function publicEntryUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href
}
