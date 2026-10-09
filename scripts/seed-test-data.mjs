// Seeds artificial data for the manual test checklist (docs/test-checklist.md).
//
//   node --env-file=.env.local scripts/seed-test-data.mjs
//
// Needs VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY (from .env.local) and asks for the
// shared admin login. Every Raffle it creates is titled "[TEST] …"; wipe everything afterwards
// with scripts/reset-test-data.sql in the Supabase SQL editor.
import { createClient } from '@supabase/supabase-js'
import { createInterface } from 'node:readline/promises'
import { randomUUID } from 'node:crypto'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (run with --env-file=.env.local).')

const rl = createInterface({ input: process.stdin, output: process.stdout })
const email = process.env.ADMIN_EMAIL || (await rl.question('Admin email: '))
const password = process.env.ADMIN_PASSWORD || (await rl.question('Admin password: '))
rl.close()

const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, key, opts)
const anon = createClient(url, key, opts)

const { error: signInError } = await admin.auth.signInWithPassword({ email, password })
if (signInError) throw new Error(`Sign-in failed: ${signInError.message}`)
if (!(await rpc('am_i_admin'))) throw new Error('That account is not the configured raffle admin.')

async function rpc(fn, args = {}) {
  const { data, error } = await admin.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data
}

async function enter(raffleId, fullName, emailAddr, deviceId = randomUUID()) {
  const { error, status } = await anon.from('entries').insert({ raffle_id: raffleId, full_name: fullName, email: emailAddr, device_id: deviceId })
  if (error) throw new Error(`entry ${emailAddr}: ${status} ${error.code} ${error.message}`)
}

const inHours = (h) => new Date(Date.now() + h * 3600_000).toISOString()
const monthsAgo = (m) => { const d = new Date(); d.setMonth(d.getMonth() - m); return d.toISOString() }
const step = (msg) => console.log(`• ${msg}`)

const state = (await rpc('public_raffle_state'))[0]
if (state && (state.status === 'open' || state.status === 'closed')) {
  throw new Error(`A Raffle is already ${state.status} ("${state.title}"). Draw or cancel it first.`)
}

// Company people. Domain mix matters: automatedcontrolsinc.com = thecomfortgroup.com for flags.
const people = [
  ['Avery Thompson', 'avery.thompson@thecomfortgroup.com'],
  ['Blake Rivera', 'brivera@thecomfortgroup.com'],
  ['Carmen Diaz', 'cdiaz@automatedcontrolsinc.com'],
  ['Devon Brooks', 'dbrooks@thecomfortgroup.com'],
  ['Elena Park', 'epark@thecomfortgroup.com'],
  ['Felix Grant', 'fgrant@automatedcontrolsinc.com'],
  ['Gina Patel', 'gpatel@thecomfortgroup.com'],
  ['Hector Nguyen', 'hnguyen@thecomfortgroup.com'],
  ['Isla Moore', 'imoore@thecomfortgroup.com'],
  ['Jamal Carter', 'jcarter@automatedcontrolsinc.com'],
  ['Kira Walsh', 'kwalsh@thecomfortgroup.com'],
  ['Luis Romero', 'lromero@thecomfortgroup.com'],
]

// 1. Past Winners (before this app existed): one still excluded, one eligible again.
step('Past winners: Jordan Pastwinner (3 months ago, still excluded), Casey Oldwin (14 months ago, eligible again)')
await rpc('add_past_winner', { p_full_name: 'Jordan Pastwinner', p_email: 'jpastwinner@thecomfortgroup.com', p_won_at: monthsAgo(3), p_note: '[TEST] Old app: Titans tickets' })
await rpc('add_past_winner', { p_full_name: 'Casey Oldwin', p_email: 'coldwin@thecomfortgroup.com', p_won_at: monthsAgo(14), p_note: '[TEST] Old app: Predators tickets' })

// 2. Overrides: Jordan forced eligible despite the window; Morgan always excluded.
step('Overrides: Jordan Pastwinner = Always eligible, Morgan Banned = Always excluded')
await rpc('set_override', { p_email: 'jpastwinner@thecomfortgroup.com', p_kind: 'force_eligible', p_reason: '[TEST] Prize was never delivered' })
await rpc('set_override', { p_email: 'mbanned@thecomfortgroup.com', p_kind: 'force_excluded', p_reason: '[TEST] Organizes the raffle' })

// 3. A Drawn Raffle with 2 Winners and one Redraw.
step('Raffle A: "[TEST] Predators vs. Stars: Two Tickets" (2 winners, drawn, one redraw)')
const a = await rpc('create_raffle', { p_title: '[TEST] Predators vs. Stars: Two Tickets', p_close_time: inHours(1), p_prize: 'Two lower-bowl seats', p_details: 'Test raffle. Delete before launch.', p_winner_count: 2 })
for (const [n, e] of people.slice(0, 8)) await enter(a, n, e)
await enter(a, 'Casey Oldwin', 'coldwin@thecomfortgroup.com') // eligible again
await rpc('close_raffle_early', { p_raffle_id: a })
const drawnA = await rpc('draw', { p_raffle_id: a })
await rpc('redraw', { p_winner_id: drawnA[0].id, p_reason: '[TEST] Winner declined the tickets' })

// 4. A Cancelled Raffle.
step('Raffle B: "[TEST] Sounds Opening Day" (cancelled)')
const b = await rpc('create_raffle', { p_title: '[TEST] Sounds Opening Day', p_close_time: inHours(24), p_prize: 'Four box seats' })
for (const [n, e] of people.slice(8, 11)) await enter(b, n, e)
await rpc('cancel_raffle', { p_raffle_id: b, p_reason: '[TEST] Game was rescheduled' })

// 5. A Drawn Raffle with a Vacant Slot: 3 Winners wanted, 2 eligible.
step('Raffle C: "[TEST] Parking Spot for a Month" (3 slots, 2 eligible -> 1 vacant)')
const c = await rpc('create_raffle', { p_title: '[TEST] Parking Spot for a Month', p_close_time: inHours(1), p_winner_count: 3 })
await enter(c, 'Kira Walsh', 'kwalsh@thecomfortgroup.com')
await enter(c, 'Luis Romero', 'lromero@thecomfortgroup.com')
await enter(c, 'Morgan Banned', 'mbanned@thecomfortgroup.com') // Always excluded
await rpc('close_raffle_early', { p_raffle_id: c })
await rpc('draw', { p_raffle_id: c })

// 6. The current Open Raffle, full of flag cases, left open for hands-on testing.
step('Raffle D: "[TEST] Titans vs. Colts: Two Tickets" (OPEN, closes in 2 days, flag cases)')
const d = await rpc('create_raffle', { p_title: '[TEST] Titans vs. Colts: Two Tickets', p_close_time: inHours(48), p_prize: 'Two club-level seats', p_details: 'Test raffle. Delete before launch.', p_winner_count: 2 })
for (const [n, e] of people) await enter(d, n, e) // includes Raffle A's Winners -> Excluded; its replaced Winner is eligible again
const sharedDevice = randomUUID()
await enter(d, 'Nora Quinn', 'nquinn@thecomfortgroup.com', sharedDevice)
await enter(d, 'Owen Quinn', 'oquinn@thecomfortgroup.com', sharedDevice) // same device
await enter(d, 'Avery Thompson', 'avery.t.personal@gmail.com') // same name, personal email
await enter(d, 'Paula Reyes', 'p.reyes+raffle@thecomfortgroup.com') // email match with the next one
await enter(d, 'P Reyes', 'preyes@automatedcontrolsinc.com')
await enter(d, 'Jordan Pastwinner', 'jpastwinner@thecomfortgroup.com') // won recently, but override = eligible
await enter(d, 'Morgan Banned', 'mbanned@thecomfortgroup.com') // override = excluded
await rpc('add_entry', { p_raffle_id: d, p_full_name: 'Quincy Added', p_email: 'qadded@thecomfortgroup.com' }) // added by admin

console.log('\nDone. Open the admin panel and follow docs/test-checklist.md.')
await admin.auth.signOut()
