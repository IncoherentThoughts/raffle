// Winners tab (#15): Winners with their Exclusion Window status, Past Winners, and
// Eligibility Overrides. Every write is an RPC that logs to the Activity Log.
import { rpc, type Enums } from './rpc'

export type OverrideKind = Enums['override_kind']

/** One Winner record as `admin_winners()` returns it (generated types drop the nulls). */
export type WinnerRow = {
  id: string
  source: Enums['winner_source']
  raffle_id: string | null
  raffle_title: string | null
  position: number | null
  full_name: string
  email: string
  email_normalized: string
  won_at: string
  status: Enums['winner_status']
  replaced_at: string | null
  replaced_reason: string | null
  note: string | null
  /** The Exclusion Window a Draw would apply now (current Raffle's, or the 12-month default). */
  window_enabled: boolean
  window_months: number
  /** Computed in the database with the Draw's rule: Standing and inside the window now. */
  excluded: boolean
  excluded_until: string | null
  override_id: string | null
  override_kind: OverrideKind | null
  override_reason: string | null
  override_expires_at: string | null
}

export type OverrideRow = {
  id: string
  email: string
  email_normalized: string
  /** Latest Entry's name (else latest Winner record's); null for an email never seen. */
  full_name: string | null
  kind: OverrideKind
  reason: string
  expires_at: string | null
  created_at: string
}

export async function listWinners(): Promise<WinnerRow[]> {
  return ((await rpc('admin_winners')) ?? []) as WinnerRow[]
}

export async function listOverrides(): Promise<OverrideRow[]> {
  return ((await rpc('admin_overrides')) ?? []) as OverrideRow[]
}

export type PastWinnerInput = { fullName: string; email: string; wonAt: string; note?: string }

export function addPastWinner({ fullName, email, wonAt, note }: PastWinnerInput): Promise<string> {
  return rpc('add_past_winner', {
    p_full_name: fullName,
    p_email: email,
    p_won_at: wonAt,
    ...(note ? { p_note: note } : {}),
  })
}

export async function deletePastWinner(winnerId: string): Promise<void> {
  await rpc('delete_past_winner', { p_winner_id: winnerId })
}

export type OverrideInput = { email: string; kind: OverrideKind; reason: string; expiresAt?: string | null }

/** Sets the Entrant's Override, superseding any current one. */
export function setOverride({ email, kind, reason, expiresAt }: OverrideInput): Promise<string> {
  return rpc('set_override', {
    p_email: email,
    p_kind: kind,
    p_reason: reason,
    ...(expiresAt ? { p_expires_at: expiresAt } : {}),
  })
}

export async function clearOverride(overrideId: string, reason: string): Promise<void> {
  await rpc('clear_override', { p_override_id: overrideId, p_reason: reason })
}
