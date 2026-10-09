import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fake } from '../../../test/fakeSupabase'
import { renderAdmin } from '../test/renderAdmin'
import { toLocalInput } from './format'

vi.mock('../../../lib/supabase', () => import('../../../test/fakeSupabase'))

const HOUR = 3600_000
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()

function raffle(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    title: 'Titans vs. Colts',
    prize: 'Two lower-bowl seats',
    details: null,
    close_time: iso(50 * HOUR),
    winner_count: 1,
    exclusion_enabled: true,
    exclusion_months: 12,
    state: 'open',
    created_at: iso(-48 * HOUR),
    drawn_at: null,
    cancelled_at: null,
    cancel_reason: null,
    ...over,
  }
}

function entry(over: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    created_at: iso(-HOUR),
    removed_at: null,
    eligible: true,
    flags: [],
    is_returning: false,
    ...over,
  }
}

const rpcCalls = (fn: string) => fake.supabase.rpc.mock.calls.filter((c) => c[0] === fn).map((c) => c[1])

function withRaffles(...rows: ReturnType<typeof raffle>[]) {
  fake.onTable('raffles', () => fake.ok(rows))
}

async function open() {
  renderAdmin('/admin/dashboard')
  expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument()
}

beforeEach(() => {
  fake.reset()
  localStorage.clear()
})

describe('No Raffle', () => {
  it('shows the create form with #6 defaults and opens a raffle', async () => {
    withRaffles()
    fake.onRpc('create_raffle', () => fake.ok('new-id'))
    await open()
    const form = await screen.findByRole('form', { name: 'Start a new raffle' })
    expect(within(form).getByLabelText('Winner Count')).toHaveValue(1)
    expect(within(form).getByRole('checkbox')).toBeChecked()
    expect(within(form).getByLabelText('Exclusion Window months')).toHaveValue(12)

    const user = userEvent.setup()
    await user.type(within(form).getByLabelText('Raffle title'), 'Grill giveaway')
    const close = toLocalInput(iso(72 * HOUR))
    fireEvent.change(within(form).getByLabelText('Close Time'), { target: { value: close } })
    await user.click(within(form).getByRole('checkbox'))
    await user.click(within(form).getByRole('button', { name: 'Open the raffle' }))

    await waitFor(() => expect(rpcCalls('create_raffle')).toHaveLength(1))
    expect(rpcCalls('create_raffle')[0]).toMatchObject({
      p_title: 'Grill giveaway',
      p_close_time: new Date(close).toISOString(),
      p_winner_count: 1,
      p_exclusion_enabled: false,
      p_exclusion_months: 12,
    })
  })

  it('validates title, a future Close Time and Winner Count >= 1 before calling the server', async () => {
    withRaffles()
    await open()
    const form = await screen.findByRole('form', { name: 'Start a new raffle' })
    const user = userEvent.setup()
    fireEvent.change(within(form).getByLabelText('Close Time'), { target: { value: toLocalInput(iso(-HOUR)) } })
    await user.clear(within(form).getByLabelText('Winner Count'))
    await user.type(within(form).getByLabelText('Winner Count'), '0')
    await user.click(within(form).getByRole('button', { name: 'Open the raffle' }))
    expect(within(form).getByText('Enter a title.')).toBeInTheDocument()
    expect(within(form).getByText('Close Time must be in the future.')).toBeInTheDocument()
    expect(within(form).getByText('Winner Count must be a whole number, at least 1.')).toBeInTheDocument()
    expect(rpcCalls('create_raffle')).toHaveLength(0)
  })

  it('after a Cancelled raffle shows the form and the last Drawn raffle’s winners below', async () => {
    withRaffles(
      raffle({ id: 'r2', state: 'cancelled', cancelled_at: iso(-HOUR), cancel_reason: 'oops' }),
      raffle({ id: 'r1', title: 'Grill', state: 'drawn', drawn_at: iso(-90 * 24 * HOUR), close_time: iso(-91 * 24 * HOUR) }),
    )
    fake.onRpc('raffle_slots', () =>
      fake.ok([{ position: 1, vacant: false, winner_id: 'w1', full_name: 'Dakota Worthen', email: 'd@x.com', won_at: iso(-HOUR), source: 'draw' }]),
    )
    fake.onRpc('alternates_remaining', () => fake.ok(3))
    fake.onTable('winners', () => fake.ok([]))
    await open()
    expect(await screen.findByRole('form', { name: 'Start a new raffle' })).toBeInTheDocument()
    const panel = (await screen.findByRole('heading', { name: "Last raffle's winners" })).closest('section')!
    expect(await within(panel).findByText('Dakota Worthen')).toBeInTheDocument()
    expect(within(panel).getByText('Grill')).toBeInTheDocument()
    expect(screen.queryByText('Current raffle')).not.toBeInTheDocument()
  })
})

describe('Open', () => {
  beforeEach(() => {
    withRaffles(raffle())
    fake.onRpc('admin_entries', () =>
      fake.ok([
        entry(),
        entry({ is_returning: true }),
        entry({ eligible: false, is_returning: true }),
        entry({ flags: ['same_name'] }),
        entry({ removed_at: iso(-HOUR), eligible: false, flags: ['same_device'] }),
      ]),
    )
  })

  it('shows status, countdown, the six stat tiles, the chart, and a disabled Draw with its hint', async () => {
    await open()
    expect(await screen.findByText('Titans vs. Colts')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText(/Closes in/)).toHaveTextContent(/Closes in 2 days 1 hr|Closes in 2 days 2 hrs/)
    const tile = async (label: string) => (await screen.findByText(label, { selector: '.stat span' })).previousSibling
    expect(await tile('Entries')).toHaveTextContent('4')
    expect(await tile('Eligible')).toHaveTextContent('3')
    expect(await tile('Excluded')).toHaveTextContent('1')
    expect(await tile('Flags')).toHaveTextContent('2')
    expect(await tile('New')).toHaveTextContent('2')
    expect(await tile('Returning')).toHaveTextContent('2')
    expect(screen.getByText('Entries over time')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^4 entries over [56] days/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Draw winner' })).toBeDisabled()
    expect(screen.getByText('enabled once entries close')).toBeInTheDocument()
  })

  it('closes early after confirming', async () => {
    fake.onRpc('close_raffle_early', () => fake.ok(null))
    await open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Close early' }))
    const dialog = screen.getByRole('dialog', { name: 'Close entries early' })
    await user.click(within(dialog).getByRole('button', { name: 'Close early' }))
    await waitFor(() => expect(rpcCalls('close_raffle_early')).toEqual([{ p_raffle_id: 'r1' }]))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('cancels only with a reason', async () => {
    fake.onRpc('cancel_raffle', () => fake.ok(null))
    await open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Cancel raffle' }))
    const dialog = screen.getByRole('dialog', { name: 'Cancel raffle' })
    const confirm = within(dialog).getByRole('button', { name: 'Cancel raffle' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Reason'), 'Tickets fell through')
    await user.click(confirm)
    await waitFor(() =>
      expect(rpcCalls('cancel_raffle')).toEqual([{ p_raffle_id: 'r1', p_reason: 'Tickets fell through' }]),
    )
  })

  it('Edit with a Close Time in the past says it will close entries, then saves', async () => {
    fake.onRpc('update_raffle', () => fake.ok(null))
    await open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit raffle' })
    expect(within(dialog).getByLabelText('Raffle title')).toHaveValue('Titans vs. Colts')
    const past = toLocalInput(iso(-HOUR))
    fireEvent.change(within(dialog).getByLabelText('Close Time'), { target: { value: past } })
    expect(within(dialog).getByText(/saving closes entries now \(Close early\)/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Save and close entries' }))
    await waitFor(() => expect(rpcCalls('update_raffle')).toHaveLength(1))
    expect(rpcCalls('update_raffle')[0]).toMatchObject({ p_raffle_id: 'r1', p_close_time: new Date(past).toISOString() })
  })
})

describe('Closed', () => {
  function closed(over: Record<string, unknown> = {}, entries = [entry(), entry(), entry({ flags: ['email_match'] })]) {
    withRaffles(raffle({ close_time: iso(-HOUR), ...over }))
    fake.onRpc('admin_entries', () => fake.ok(entries))
  }

  it('replaces the countdown with "Entries closed" and draws after the #6 confirm', async () => {
    closed()
    fake.onRpc('draw', () => fake.ok([]))
    await open()
    expect(await screen.findByText('Entries closed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close early' })).not.toBeInTheDocument()
    const user = userEvent.setup()
    const draw = await screen.findByRole('button', { name: 'Draw winner' })
    await waitFor(() => expect(draw).toBeEnabled())
    await user.click(draw)
    const dialog = screen.getByRole('dialog', { name: 'Draw winners' })
    expect(dialog).toHaveTextContent(
      'Draw 1 winner from 3 eligible entries? This is final; winners can only be changed by Redraw.',
    )
    expect(dialog).toHaveTextContent('1 entry carries undismissed flags.')
    await user.click(within(dialog).getByRole('button', { name: 'Draw' }))
    await waitFor(() => expect(rpcCalls('draw')).toEqual([{ p_raffle_id: 'r1' }]))
  })

  it('warns about vacant slots when there are fewer eligible entries than slots', async () => {
    closed({ winner_count: 3 }, [entry(), entry(), entry({ eligible: false })])
    await open()
    const user = userEvent.setup()
    const draw = await screen.findByRole('button', { name: 'Draw winners' })
    await waitFor(() => expect(draw).toBeEnabled())
    await user.click(draw)
    const dialog = screen.getByRole('dialog', { name: 'Draw winners' })
    expect(dialog).toHaveTextContent('Only 2 eligible entries for 3 slots. Draw 2 winners and leave the rest vacant?')
    expect(dialog).toHaveTextContent('0 entries carry undismissed flags.')
  })

  it('Edit with a future Close Time warns that saving reopens it', async () => {
    closed()
    await open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit raffle' })
    fireEvent.change(within(dialog).getByLabelText('Close Time'), { target: { value: toLocalInput(iso(24 * HOUR)) } })
    expect(within(dialog).getByText(/saving reopens the raffle for entries until/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Save and reopen' })).toBeInTheDocument()
  })

  it('shows a friendly inline error when the Draw fails', async () => {
    closed()
    fake.onRpc('draw', () => fake.dbError('no_eligible_entries', '55000'))
    await open()
    const user = userEvent.setup()
    const draw = await screen.findByRole('button', { name: 'Draw winner' })
    await waitFor(() => expect(draw).toBeEnabled())
    await user.click(draw)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Draw' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('There are no eligible entries to draw from.')
  })
})

describe('Drawn', () => {
  beforeEach(() => {
    withRaffles(raffle({ state: 'drawn', winner_count: 2, close_time: iso(-2 * HOUR), drawn_at: iso(-HOUR) }))
    fake.onRpc('raffle_slots', () =>
      fake.ok([
        { position: 1, vacant: false, winner_id: 'w3', full_name: 'Jim Lee', email: 'jim@x.com', won_at: iso(-HOUR), source: 'redraw' },
        { position: 2, vacant: true, winner_id: null, full_name: null, email: null, won_at: null, source: null },
      ]),
    )
    fake.onTable('winners', () =>
      fake.ok([
        { id: 'w1', position: 1, full_name: 'Ann Fox', status: 'replaced', replaced_at: iso(-HOUR), replaced_reason: 'Out of town' },
        { id: 'w2', position: 2, full_name: 'Bo Diaz', status: 'replaced', replaced_at: iso(-HOUR), replaced_reason: 'Declined' },
        { id: 'w3', position: 1, full_name: 'Jim Lee', status: 'standing', replaced_at: null, replaced_reason: null },
      ]),
    )
    fake.onRpc('alternates_remaining', () => fake.ok(0))
  })

  it('shows the gold winner panel with vacant slots, Redraw count + reasons, and the create form below', async () => {
    await open()
    const panel = (await screen.findByRole('heading', { name: 'Winners' })).closest('section')!
    expect(panel).toHaveClass('panel--gold')
    expect(await within(panel).findByText('Jim Lee')).toBeInTheDocument()
    expect(within(panel).getByText('Slot 2: vacant (no eligible alternates)')).toBeInTheDocument()
    expect(within(panel).getByText(/Redraws:/)).toHaveTextContent('Redraws: 2')
    expect(within(panel).getByText(/Ann Fox replaced/)).toHaveTextContent('“Out of town”')
    expect(screen.getByRole('form', { name: 'Start a new raffle' })).toBeInTheDocument()
  })

  it('redraws a Winner with a reason and says when the slot will go vacant', async () => {
    fake.onRpc('redraw', () => fake.ok([{ replaced_winner_id: 'w3', new_winner_id: null, position: 1, vacant: true }]))
    await open()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Redraw Jim Lee' }))
    const dialog = screen.getByRole('dialog', { name: 'Redraw slot 1' })
    expect(dialog).toHaveTextContent('No eligible alternates remain: slot 1 will be left vacant.')
    await user.type(within(dialog).getByLabelText('Reason'), 'Can’t attend')
    await user.click(within(dialog).getByRole('button', { name: 'Redraw' }))
    await waitFor(() => expect(rpcCalls('redraw')).toEqual([{ p_winner_id: 'w3', p_reason: 'Can’t attend' }]))
  })
})
