import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fake } from '../../../test/fakeSupabase'
import { currentPath, renderAdmin } from '../test/renderAdmin'

vi.mock('../../../lib/supabase', () => import('../../../test/fakeSupabase'))

beforeEach(() => fake.reset())

const raffle = (o: Record<string, unknown> = {}) => ({
  id: 'r1',
  title: 'Titans home opener',
  prize: 'Two tickets',
  details: null,
  close_time: '2026-09-10T17:00:00Z',
  winner_count: 2,
  exclusion_enabled: true,
  exclusion_months: 12,
  state: 'drawn',
  created_at: '2026-09-01T15:00:00Z',
  drawn_at: '2026-09-10T18:00:00Z',
  cancelled_at: null,
  cancel_reason: null,
  ...o,
})

const winner = (o: Record<string, unknown>) => ({
  source: 'draw',
  raffle_id: 'r1',
  replaces_winner_id: null,
  email_normalized: '',
  won_at: '2026-09-10T18:00:00Z',
  status: 'standing',
  replaced_at: null,
  replaced_reason: null,
  note: null,
  created_at: '2026-09-10T18:00:00Z',
  ...o,
})

const snapEntry = (o: Record<string, unknown>) => ({
  raffle_id: 'r1',
  email_normalized: '',
  eligible: true,
  reason: 'eligible',
  excluding_winner_id: null,
  excluding_won_at: null,
  override_id: null,
  override_reason: null,
  flags: [],
  ...o,
})

const log = (o: Record<string, unknown>) => ({
  raffle_id: 'r1',
  target_type: 'raffle',
  target_id: 'r1',
  target_label: 'Titans home opener',
  reason: null,
  details: {},
  raffles: { title: 'Titans home opener', state: 'drawn' },
  ...o,
})

describe('History list', () => {
  it('shows one row per Drawn or Cancelled Raffle with counts, Winners and Redraws', async () => {
    fake.onTable('raffles', () =>
      fake.ok([
        {
          ...raffle({ winner_count: 3 }),
          draw_snapshots: { eligible_count: 7, excluded_count: 3, removed: [{ count: 1 }] },
          entries: [{ count: 10 }],
          winners: [{ status: 'standing' }, { status: 'replaced' }, { status: 'replaced' }, { status: 'standing' }],
        },
        {
          ...raffle({
            id: 'r2',
            title: 'Sounds opening day',
            state: 'cancelled',
            drawn_at: null,
            close_time: '2026-08-09T17:00:00Z',
            cancelled_at: '2026-08-05T12:00:00Z',
            cancel_reason: 'Rained out',
          }),
          draw_snapshots: null,
          entries: [{ count: 4 }],
          winners: [],
        },
      ]),
    )
    renderAdmin('/admin/history')
    const table = await screen.findByRole('table', { name: 'Completed raffles' })
    const [, drawn, cancelled] = within(table).getAllByRole('row')
    expect(drawn).toHaveTextContent('Titans home opener')
    expect(drawn).toHaveTextContent('10 (7 / 2), 1 removed')
    expect(drawn).toHaveTextContent('2 of 3 (1 vacant)')
    expect(within(drawn).getAllByRole('cell').at(-1)).toHaveTextContent('2')
    expect(cancelled).toHaveTextContent('Cancelled')
    // Cancelled before its Close Time: entries stopped at the cancellation, not Aug 9.
    const [, , closed] = within(cancelled).getAllByRole('cell')
    expect(closed).toHaveTextContent('Aug 5, 2026')
    expect(within(cancelled).getByRole('link', { name: 'Sounds opening day' })).toHaveAttribute(
      'href',
      '/admin/history/r2',
    )
    expect(screen.queryByText('Entries per raffle')).not.toBeInTheDocument()
  })

  it('says so when nothing is completed yet', async () => {
    fake.onTable('raffles', () => fake.ok([]))
    renderAdmin('/admin/history')
    expect(await screen.findByText('No completed raffles yet')).toBeInTheDocument()
  })

  it('opens the Activity log sub-page', async () => {
    fake.onTable('raffles', () => fake.ok([]))
    renderAdmin('/admin/history')
    await userEvent.setup().click(await screen.findByRole('link', { name: 'Activity log' }))
    expect(await screen.findByRole('heading', { name: 'Activity log', level: 1 })).toBeInTheDocument()
    expect(currentPath()).toBe('/admin/history/activity')
  })
})

describe('Raffle detail', () => {
  function drawnRaffle() {
    fake.onTable('raffles', () => fake.ok(raffle({ winner_count: 2 })))
    fake.onTable('draw_snapshots', () =>
      fake.ok({ raffle_id: 'r1', drawn_at: '2026-09-10T18:00:00Z', winner_count: 2, eligible_count: 3, excluded_count: 2, flagged_count: 2 }),
    )
    fake.onTable('winners', () =>
      fake.ok([
        winner({
          id: 'w1', position: 1, entry_id: 'e1', full_name: 'Jane Doe', email: 'jane@x.test',
          status: 'replaced', replaced_at: '2026-09-11T10:00:00Z', replaced_reason: 'Out of town',
        }),
        winner({
          id: 'w2', position: 2, entry_id: 'e2', full_name: 'Avery Kim', email: 'avery@x.test',
          status: 'replaced', replaced_at: '2026-09-11T11:00:00Z', replaced_reason: 'Cannot attend',
        }),
        winner({
          id: 'w3', source: 'redraw', replaces_winner_id: 'w1', position: 1, entry_id: 'e3',
          full_name: 'Tom Okafor', email: 'tom@x.test', won_at: '2026-09-11T10:00:00Z',
        }),
      ]),
    )
    fake.onTable('draw_snapshot_entries', () =>
      fake.ok([
        snapEntry({ entry_id: 'e1', full_name: 'Jane Doe', email: 'jane@x.test', flags: ['same_name'] }),
        snapEntry({ entry_id: 'e2', full_name: 'Avery Kim', email: 'avery@x.test' }),
        snapEntry({ entry_id: 'e3', full_name: 'Tom Okafor', email: 'tom@x.test', flags: ['email_match'] }),
        snapEntry({ entry_id: 'e4', full_name: 'Sam Reed', email: 'sam@x.test', eligible: false, reason: 'removed' }),
        snapEntry({
          entry_id: 'e5', full_name: 'Lena Ortiz', email: 'lena@x.test', eligible: false,
          reason: 'exclusion_window', excluding_won_at: '2026-03-15T12:00:00Z',
        }),
      ]),
    )
    fake.onTable('activity_log', () =>
      fake.ok([
        log({
          id: 3, at: '2026-09-11T11:00:00Z', action: 'redraw', target_type: 'winner', target_label: 'Avery Kim',
          reason: 'Cannot attend', details: { position: 2, replaced_name: 'Avery Kim', vacant: true },
        }),
        log({
          id: 2, at: '2026-09-11T10:00:00Z', action: 'redraw', target_type: 'winner', target_label: 'Jane Doe',
          reason: 'Out of town', details: { position: 1, replaced_name: 'Jane Doe', new_name: 'Tom Okafor', vacant: false },
        }),
        log({ id: 1, at: '2026-09-10T18:00:00Z', action: 'draw', details: { winner_count: 2, eligible: 3, winners: [] } }),
      ]),
    )
  }

  it('shows header facts and links to the Raffle\'s Entries', async () => {
    drawnRaffle()
    renderAdmin('/admin/history/r1')
    expect(await screen.findByRole('heading', { name: 'Titans home opener', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Two tickets')).toBeInTheDocument()
    expect(screen.getByText('On, 12 months')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View entries' })).toHaveAttribute('href', '/admin/entries/r1')
    expect(screen.getByRole('link', { name: '← History' })).toHaveAttribute('href', '/admin/history')
    // Snapshot says 2 excluded, one of them Removed: the tiles split them so they add up to Entries.
    const tile = (label: string) => screen.getByText(label, { selector: '.stat span' }).closest('.stat')
    expect(tile('Entries')).toHaveTextContent('5')
    expect(tile('Excluded')).toHaveTextContent('1')
    expect(tile('Removed')).toHaveTextContent('1')
  })

  it('shows each Winner slot with its Redraw chain, reasons and vacant slot', async () => {
    drawnRaffle()
    renderAdmin('/admin/history/r1')
    const winners = (await screen.findByRole('heading', { name: 'Winners' })).closest('section')!
    const [slot1, slot2] = within(winners).getAllByRole('listitem').filter((li) => li.classList.contains('history-slot'))
    expect(slot1).toHaveTextContent('Tom Okafor')
    expect(within(slot1).getByRole('list', { name: 'Slot 1 Redraw chain' })).toHaveTextContent('Jane Doe')
    expect(slot1).toHaveTextContent('Out of town')
    expect(slot2).toHaveTextContent('Slot 2Vacant (no eligible alternates)')
    expect(slot2).toHaveTextContent('Cannot attend')
  })

  it('shows the Draw Snapshot with per-Entry verdicts and frozen flags', async () => {
    drawnRaffle()
    renderAdmin('/admin/history/r1')
    const table = await screen.findByRole('table', { name: 'Draw Snapshot' })
    const row = (name: string) => within(table).getByRole('cell', { name: new RegExp(`^${name}`) }).closest('tr')!
    expect(row('Jane Doe')).toHaveTextContent('same name')
    expect(row('Jane Doe')).toHaveTextContent('Replaced, slot 1')
    expect(row('Tom Okafor')).toHaveTextContent('email match')
    expect(row('Tom Okafor')).toHaveTextContent('Winner, slot 1')
    expect(row('Sam Reed')).toHaveTextContent('Excluded: removed')
    expect(row('Lena Ortiz')).toHaveTextContent(/Excluded: won Mar 1[45], 2026/)
    expect(row('Avery Kim')).toHaveTextContent('Eligible')
  })

  it('shows that Raffle\'s Activity Log in readable sentences', async () => {
    drawnRaffle()
    renderAdmin('/admin/history/r1')
    const table = await screen.findByRole('table', { name: 'Activity log' })
    expect(table).toHaveTextContent('Redrew slot 1: replaced Jane Doe with Tom Okafor')
    expect(table).toHaveTextContent('Redrew slot 2: replaced Avery Kim; no eligible alternates, slot left vacant')
    expect(table).toHaveTextContent('Drew 0 winners from 3 eligible entries; 2 slots left vacant')
  })

  it('shows a Cancelled Raffle\'s reason instead of Winners and Snapshot', async () => {
    fake.onTable('raffles', () =>
      fake.ok(raffle({ state: 'cancelled', drawn_at: null, cancelled_at: '2026-09-05T12:00:00Z', cancel_reason: 'Game rained out' })),
    )
    fake.onTable('activity_log', () =>
      fake.ok([log({ id: 9, at: '2026-09-05T12:00:00Z', action: 'raffle_cancel', reason: 'Game rained out' })]),
    )
    renderAdmin('/admin/history/r1')
    const cancelled = (await screen.findByRole('heading', { name: 'Cancelled' })).closest('section')!
    expect(cancelled).toHaveTextContent('Game rained out')
    expect(screen.queryByRole('heading', { name: 'Winners' })).not.toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Draw Snapshot' })).not.toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Activity log' })).toHaveTextContent('Cancelled the raffle')
  })

  it('says when the Raffle does not exist', async () => {
    fake.onTable('raffles', () => fake.ok(null))
    renderAdmin('/admin/history/nope')
    expect(await screen.findByText('Raffle not found')).toBeInTheDocument()
  })
})

describe('Activity log page', () => {
  it('lists every action with its target, Raffle and reason, and pages back in time', async () => {
    const rows = Array.from({ length: 101 }, (_, i) =>
      log({
        id: 1000 - i,
        at: '2026-09-11T11:00:00Z',
        action: 'entry_remove',
        target_type: 'entry',
        target_label: `Person ${i} <p${i}@x.test>`,
        reason: 'Left the company',
      }),
    )
    let calls = 0
    fake.onTable('activity_log', () => {
      calls++
      return fake.ok(calls === 1 ? rows : rows.slice(0, 101))
    })
    renderAdmin('/admin/history/activity')
    const table = await screen.findByRole('table', { name: 'Activity log' })
    const first = within(table).getAllByRole('row')[1]
    expect(first).toHaveTextContent('Removed an entry')
    expect(first).toHaveTextContent('Person 0 <p0@x.test>')
    expect(within(first).getByRole('link', { name: 'Titans home opener' })).toHaveAttribute('href', '/admin/history/r1')
    expect(first).toHaveTextContent('Left the company')
    expect(within(table).getAllByRole('row')).toHaveLength(101) // header + 100
    await userEvent.setup().click(screen.getByRole('button', { name: 'Show older' }))
    await screen.findByText('Person 100 <p100@x.test>')
  })
})
