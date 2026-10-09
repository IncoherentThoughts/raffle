// Dashboard (#13): raffles, stats, Draw, Redraw. Conventions: src/pages/admin/README.md.
import { supabase } from '../supabase'
import { unwrap } from './errors'
import { rpc, type Functions, type Row } from './rpc'

export type Raffle = Row<'raffles'>
export type Winner = Row<'winners'>
export type AdminEntry = Functions['admin_entries']['Returns'][number]
export type Slot = Functions['raffle_slots']['Returns'][number]

/** Raffle state as the admin sees it: "closed" is derived from the Close Time (#4). */
export type RaffleStatus = 'open' | 'closed' | 'drawn' | 'cancelled'

export function raffleStatus(r: Pick<Raffle, 'state' | 'close_time'>, now = Date.now()): RaffleStatus {
  if (r.state === 'open') return new Date(r.close_time).getTime() <= now ? 'closed' : 'open'
  return r.state
}

export type DashboardRaffles = {
  /** The most recent Raffle (any state), or null when none exist yet. */
  latest: Raffle | null
  /** The most recent Drawn Raffle (for the winner panel), or null. */
  lastDrawn: Raffle | null
}

/** The latest Raffle plus the latest Drawn one, from one read of recent Raffles. */
export async function dashboardRaffles(): Promise<DashboardRaffles> {
  const rows: Raffle[] =
    unwrap(await supabase.from('raffles').select('*').order('created_at', { ascending: false }).limit(50)) ?? []
  return { latest: rows[0] ?? null, lastDrawn: rows.find((r) => r.state === 'drawn') ?? null }
}

export const raffleEntries = (raffleId: string) => rpc('admin_entries', { p_raffle_id: raffleId })

export type WinnerPanelData = {
  slots: Slot[]
  /** Every drawn/redrawn Winner of the Raffle, Replaced ones included (Redraw history). */
  winners: Winner[]
  alternatesRemaining: number
}

export async function winnerPanel(raffleId: string): Promise<WinnerPanelData> {
  const [slots, winners, alternatesRemaining] = await Promise.all([
    rpc('raffle_slots', { p_raffle_id: raffleId }),
    supabase
      .from('winners')
      .select('*')
      .eq('raffle_id', raffleId)
      .order('won_at', { ascending: true })
      .then((r) => unwrap(r) ?? []),
    rpc('alternates_remaining', { p_raffle_id: raffleId }),
  ])
  return { slots: slots ?? [], winners, alternatesRemaining: alternatesRemaining ?? 0 }
}

export type RaffleInput = {
  title: string
  prize: string
  details: string
  /** ISO timestamp. */
  closeTime: string
  winnerCount: number
  exclusionEnabled: boolean
  exclusionMonths: number
}

export const createRaffle = (v: RaffleInput) =>
  rpc('create_raffle', {
    p_title: v.title,
    p_prize: v.prize,
    p_details: v.details,
    p_close_time: v.closeTime,
    p_winner_count: v.winnerCount,
    p_exclusion_enabled: v.exclusionEnabled,
    p_exclusion_months: v.exclusionMonths,
  })

export const updateRaffle = (raffleId: string, v: RaffleInput) =>
  rpc('update_raffle', {
    p_raffle_id: raffleId,
    p_title: v.title,
    p_prize: v.prize,
    p_details: v.details,
    p_close_time: v.closeTime,
    p_winner_count: v.winnerCount,
    p_exclusion_enabled: v.exclusionEnabled,
    p_exclusion_months: v.exclusionMonths,
  })

export const closeRaffleEarly = (raffleId: string) => rpc('close_raffle_early', { p_raffle_id: raffleId })

export const cancelRaffle = (raffleId: string, reason: string) =>
  rpc('cancel_raffle', { p_raffle_id: raffleId, p_reason: reason })

export const drawRaffle = (raffleId: string) => rpc('draw', { p_raffle_id: raffleId })

export const redrawWinner = (winnerId: string, reason: string) =>
  rpc('redraw', { p_winner_id: winnerId, p_reason: reason })
