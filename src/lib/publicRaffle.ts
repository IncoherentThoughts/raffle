import { supabase } from './supabase'

/** Status as the public page sees it. Cancelled Raffles read as 'none'. */
export type PublicStatus = 'open' | 'closed' | 'drawn' | 'none'

export type PublicRaffle = {
  raffleId: string | null
  title: string
  prize: string | null
  details: string | null
  closeTime: Date | null
  status: PublicStatus
  /** Standing Winners in slot order; Vacant Slots are already omitted. */
  winnerNames: string[]
}

type StateRow = {
  raffle_id: string | null
  title: string | null
  prize: string | null
  details: string | null
  close_time: string | null
  status: PublicStatus
  winner_names: string[] | null
}

const NONE: PublicRaffle = {
  raffleId: null, title: '', prize: null, details: null, closeTime: null, status: 'none', winnerNames: [],
}

/** The current Raffle via `public_raffle_state()`. Throws if the server can't be reached. */
export async function fetchPublicRaffle(): Promise<PublicRaffle> {
  const { data, error } = await supabase.rpc('public_raffle_state')
  if (error) throw new Error(error.message || 'public_raffle_state failed')
  const row = (Array.isArray(data) ? data[0] : data) as StateRow | undefined
  if (!row || row.status === 'none' || !row.raffle_id) return NONE
  return {
    raffleId: row.raffle_id,
    title: row.title ?? '',
    prize: row.prize?.trim() || null,
    details: row.details?.trim() || null,
    closeTime: row.close_time ? new Date(row.close_time) : null,
    status: row.status,
    winnerNames: row.winner_names ?? [],
  }
}

export type EntryOutcome =
  | 'entered'
  | 'already_entered' // 23505: this Entrant already has an Entry; nothing was written
  | 'not_open' // 42501: the Raffle closed (or changed) since the page loaded
  | 'invalid' // 23514 and friends: blank name / malformed email got past the form
  | 'rate_limited' // HTTP 429 from the per-IP limiter
  | 'unreachable' // network down, project paused, 5xx, anything unexpected

export type NewEntry = { raffleId: string; fullName: string; email: string; deviceId: string }

/**
 * Inserts one Entry through the anon policy. No `.select()`: anon cannot read
 * Entries back, and asking would turn a successful insert into an RLS error.
 */
export async function submitEntry(entry: NewEntry): Promise<EntryOutcome> {
  let result: { error: { code?: string } | null; status?: number }
  try {
    result = await supabase.from('entries').insert({
      raffle_id: entry.raffleId,
      full_name: entry.fullName,
      email: entry.email,
      device_id: entry.deviceId,
    })
  } catch {
    return 'unreachable'
  }
  const { error, status } = result
  if (!error) return 'entered'
  if (status === 429 || error.code === 'PT429') return 'rate_limited'
  switch (error.code) {
    case '23505':
      return 'already_entered'
    case '42501':
      return 'not_open'
    case '23514':
    case '23502':
    case '22001':
      return 'invalid'
    default:
      return 'unreachable'
  }
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/ // same shape the database checks

/** Client-side mirror of the Entry constraints. Returns an error message or null. */
export function validateEntry(fullName: string, email: string): string | null {
  const name = fullName.trim()
  const mail = email.trim()
  if (!name && !mail) return 'Please enter your full name and work email.'
  if (!name) return 'Please enter your full name.'
  if (name.length > 200) return 'That name is too long. Please shorten it.'
  if (!mail) return 'Please enter your work email.'
  if (mail.length > 254 || !EMAIL.test(mail)) return 'That email address doesn’t look right. Please check it.'
  return null
}
