import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { OverrideRow, WinnerRow } from '../../../lib/api/winners'
import { fake } from '../../../test/fakeSupabase'
import { renderAdmin } from '../test/renderAdmin'

vi.mock('../../../lib/supabase', () => import('../../../test/fakeSupabase'))

const winner = (over: Partial<WinnerRow>): WinnerRow => ({
  id: 'w',
  source: 'draw',
  raffle_id: 'r1',
  raffle_title: 'Labor Day Grill Giveaway',
  position: 1,
  full_name: 'Someone',
  email: 'someone@example.com',
  email_normalized: 'someone@example.com',
  won_at: '2026-08-19T17:00:00Z',
  status: 'standing',
  replaced_at: null,
  replaced_reason: null,
  note: null,
  window_enabled: true,
  window_months: 12,
  excluded: true,
  excluded_until: '2027-08-19T17:00:00Z',
  override_id: null,
  override_kind: null,
  override_reason: null,
  override_expires_at: null,
  ...over,
})

const DAKOTA = winner({ id: 'w1', full_name: 'Dakota Worthen', email: 'dworthen@example.com' })
const AMY = winner({
  id: 'w2',
  full_name: 'Amy Ng',
  email: 'amy@example.com',
  won_at: '2026-05-03T17:00:00Z',
  status: 'replaced',
  replaced_at: '2026-05-04T17:00:00Z',
  replaced_reason: 'could not attend',
  excluded: false,
  excluded_until: null,
})
const ANA = winner({
  id: 'w3',
  source: 'past',
  raffle_id: null,
  raffle_title: null,
  position: null,
  full_name: 'Ana Kowalski',
  email: 'akowalski@example.com',
  won_at: '2025-10-02T05:00:00Z',
  note: 'Titans Home Opener 2025',
  excluded: false,
  excluded_until: '2026-10-02T05:00:00Z',
  override_id: 'o1',
  override_kind: 'force_eligible',
  override_reason: 'manager approved',
})
const OVERRIDES: OverrideRow[] = [
  {
    id: 'o1',
    email: 'akowalski@example.com',
    email_normalized: 'akowalski@example.com',
    full_name: 'Ana Kowalski',
    kind: 'force_eligible',
    reason: 'manager approved',
    expires_at: null,
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'o2',
    email: 'vendor@example.com',
    email_normalized: 'vendor@example.com',
    full_name: null,
    kind: 'force_excluded',
    reason: 'prize vendor staff',
    expires_at: '2026-12-01T12:00:00Z',
    created_at: '2026-09-02T00:00:00Z',
  },
]

function setup({ winners = [DAKOTA, AMY, ANA], overrides = OVERRIDES } = {}) {
  fake.onRpc('admin_winners', () => fake.ok(winners))
  fake.onRpc('admin_overrides', () => fake.ok(overrides))
  renderAdmin('/admin/winners')
  return userEvent.setup()
}

const winnersTable = () => screen.findByRole('table', { name: 'Winners, newest first' })
const rowFor = async (name: string) =>
  within(await winnersTable()).getByRole('cell', { name: new RegExp(`^${name}`) }).closest('tr') as HTMLElement
const rpcCalls = (fn: string) => fake.supabase.rpc.mock.calls.filter(([f]) => f === fn).map(([, a]) => a)

beforeEach(() => fake.reset())

describe('Winners tab', () => {
  it('lists Standing Winners by default with status and override, newest first as returned', async () => {
    setup()
    expect(await screen.findByRole('heading', { name: 'Winners', level: 1 })).toBeInTheDocument()
    const table = await winnersTable()
    const names = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((r) => within(r).getAllByRole('cell')[0].querySelector('.winners__nowrap')?.textContent)
    expect(names).toEqual(['Dakota Worthen', 'Ana Kowalski'])

    const dakota = await rowFor('Dakota Worthen')
    expect(dakota).toHaveTextContent('Labor Day Grill Giveaway')
    expect(within(dakota).getByText('Excluded 12 mo').closest('[title]')).toHaveAttribute(
      'title',
      'Excluded from draws until Aug 19, 2027',
    )
    expect(dakota).toHaveTextContent('—')
    expect(within(dakota).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument()

    const ana = await rowFor('Ana Kowalski')
    expect(ana).toHaveTextContent('Titans Home Opener 2025')
    expect(ana).toHaveTextContent('Eligible again')
    expect(within(ana).getByText('Always eligible').closest('[title]')).toHaveAttribute('title', 'manager approved')
    expect(screen.getByText(/excluded from new draws for 12 months/)).toBeInTheDocument()
  })

  it('includes Replaced Winners with the toggle', async () => {
    const user = setup()
    await winnersTable()
    expect(screen.queryByRole('cell', { name: /^Amy Ng/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /Include replaced/ }))
    const amy = await rowFor('Amy Ng')
    expect(amy).toHaveClass('row--muted')
    expect(within(amy).getByText('Replaced').closest('[title]')).toHaveAttribute(
      'title',
      'Replaced: could not attend',
    )
  })

  it('shows the empty state with Add past winner when there are no winners', async () => {
    setup({ winners: [], overrides: [] })
    expect(await screen.findByRole('heading', { name: 'No winners yet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add past winner' })).toBeInTheDocument()
    expect(screen.getByText('No active overrides.')).toBeInTheDocument()
  })

  it('adds a past winner and reloads', async () => {
    const user = setup()
    await winnersTable()
    fake.onRpc('add_past_winner', () => fake.ok('w9'))
    await user.click(screen.getByRole('button', { name: 'Add past winner' }))
    const dialog = screen.getByRole('dialog', { name: 'Add past winner' })
    await user.click(within(dialog).getByRole('button', { name: 'Add past winner' }))
    expect(within(dialog).getByText('Enter a name.')).toBeInTheDocument()
    expect(rpcCalls('add_past_winner')).toHaveLength(0)

    await user.type(within(dialog).getByLabelText('Name'), 'Tom Baxter')
    await user.type(within(dialog).getByLabelText('Email'), 'tbaxter@example.com')
    await user.type(within(dialog).getByLabelText('Won date'), '2026-05-03')
    await user.type(within(dialog).getByLabelText(/Note/), 'Predators tickets')
    const before = rpcCalls('admin_winners').length
    await user.click(within(dialog).getByRole('button', { name: 'Add past winner' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(rpcCalls('add_past_winner')).toEqual([
      {
        p_full_name: 'Tom Baxter',
        p_email: 'tbaxter@example.com',
        p_won_at: new Date(2026, 4, 3).toISOString(),
        p_note: 'Predators tickets',
      },
    ])
    await waitFor(() => expect(rpcCalls('admin_winners').length).toBeGreaterThan(before))
  })

  it('shows a friendly inline error when adding fails', async () => {
    const user = setup()
    await winnersTable()
    fake.onRpc('add_past_winner', () => fake.dbError('invalid_email', '22023'))
    await user.click(screen.getByRole('button', { name: 'Add past winner' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'Tom')
    await user.type(within(dialog).getByLabelText('Email'), 'tom@example.com')
    await user.type(within(dialog).getByLabelText('Won date'), '2026-05-03')
    await user.click(within(dialog).getByRole('button', { name: 'Add past winner' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Enter a valid email address.')
  })

  it('deletes a past winner (Past Winners only) after confirming', async () => {
    const user = setup()
    fake.onRpc('delete_past_winner', () => fake.ok(null))
    await user.click(await screen.findByRole('button', { name: 'Delete Ana Kowalski' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete past winner' })
    expect(dialog).toHaveTextContent('Ana Kowalski')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(rpcCalls('delete_past_winner')).toEqual([{ p_winner_id: 'w3' }])
  })

  it('keeps the delete dialog open with the error when the database refuses', async () => {
    const user = setup()
    fake.onRpc('delete_past_winner', () => fake.dbError('not_past_winner', '55000'))
    await user.click(await screen.findByRole('button', { name: 'Delete Ana Kowalski' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Only past winners can be deleted')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('sets an override on a winner with a reason and optional expiry', async () => {
    const user = setup()
    fake.onRpc('set_override', () => fake.ok('o9'))
    await user.click(await screen.findByRole('button', { name: 'Set override for Dakota Worthen' }))
    const dialog = screen.getByRole('dialog', { name: 'Set override' })
    expect(dialog).toHaveTextContent('Dakota Worthen')
    const save = within(dialog).getByRole('button', { name: 'Save override' })
    expect(save).toBeDisabled()
    await user.click(within(dialog).getByRole('radio', { name: 'Always excluded' }))
    await user.type(within(dialog).getByLabelText('Reason'), 'won elsewhere')
    await user.type(within(dialog).getByLabelText(/Expires on/), '2099-01-31')
    await user.click(save)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(rpcCalls('set_override')).toEqual([
      {
        p_email: 'dworthen@example.com',
        p_kind: 'force_excluded',
        p_reason: 'won elsewhere',
        p_expires_at: new Date(2099, 0, 31).toISOString(),
      },
    ])
  })

  it('clears a winner\'s override with a reason', async () => {
    const user = setup()
    fake.onRpc('clear_override', () => fake.ok(null))
    await user.click(within(await rowFor('Ana Kowalski')).getByRole('button', { name: 'Clear override for Ana Kowalski' }))
    const dialog = screen.getByRole('dialog', { name: 'Clear override' })
    const confirm = within(dialog).getByRole('button', { name: 'Clear override' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Reason'), 'policy changed')
    await user.click(confirm)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(rpcCalls('clear_override')).toEqual([{ p_override_id: 'o1', p_reason: 'policy changed' }])
  })
})

describe('Eligibility overrides', () => {
  it('lists active overrides with type, reason and expiry', async () => {
    setup()
    const table = await screen.findByRole('table', { name: 'Active eligibility overrides' })
    const vendor = within(table).getByRole('cell', { name: 'vendor@example.com' }).closest('tr') as HTMLElement
    expect(vendor).toHaveTextContent('Always excluded')
    expect(vendor).toHaveTextContent('prize vendor staff')
    expect(vendor).toHaveTextContent('Dec 1, 2026')
    expect(within(table).getByRole('cell', { name: 'Ana Kowalski' }).closest('tr')).toHaveTextContent('Never')
  })

  it('adds an override for any email, so a non-winner can be force-excluded', async () => {
    const user = setup()
    fake.onRpc('set_override', () => fake.ok('o9'))
    await user.click(await screen.findByRole('button', { name: 'Add override' }))
    const dialog = screen.getByRole('dialog', { name: 'Add override' })
    await user.type(within(dialog).getByLabelText('Reason'), 'raffle organiser')
    await user.click(within(dialog).getByRole('button', { name: 'Save override' }))
    expect(within(dialog).getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(within(dialog).getByText('Choose Always eligible or Always excluded.')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Email'), 'organiser@example.com')
    await user.click(within(dialog).getByRole('radio', { name: 'Always excluded' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save override' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(rpcCalls('set_override')).toEqual([
      { p_email: 'organiser@example.com', p_kind: 'force_excluded', p_reason: 'raffle organiser' },
    ])
  })

  it('clears an override from the list', async () => {
    const user = setup()
    fake.onRpc('clear_override', () => fake.ok(null))
    await user.click(await screen.findByRole('button', { name: 'Clear override for vendor@example.com' }))
    const dialog = screen.getByRole('dialog', { name: 'Clear override' })
    expect(dialog).toHaveTextContent('vendor@example.com')
    await user.type(within(dialog).getByLabelText('Reason'), 'contract ended')
    await user.click(within(dialog).getByRole('button', { name: 'Clear override' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(rpcCalls('clear_override')).toEqual([{ p_override_id: 'o2', p_reason: 'contract ended' }])
  })
})
