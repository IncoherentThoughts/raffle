import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fake } from '../../../test/fakeSupabase'
import { renderAdmin } from '../test/renderAdmin'
import { entry, pair } from './testFixtures'

vi.mock('../../../lib/supabase', () => import('../../../test/fakeSupabase'))

const RAFFLE = {
  id: 'r1', title: 'Titans vs. Colts', close_time: '2026-10-20T22:00:00Z', created_at: '2026-10-01T12:00:00Z',
  drawn_at: null, state: 'open', status: 'open',
}

const jim = entry({ id: 'jim', full_name: 'Jim Lee', email: 'jlee@thecomfortgroup.com', flags: ['same_device'], device_id: 'd1' })
const james = entry({ id: 'james', full_name: 'James Lee', email: 'james.lee@thecomfortgroup.com', flags: ['same_device'], device_id: 'd1', added_by_admin: true })
const tom = entry({ id: 'tom', full_name: 'Tom Baxter', email: 'tbaxter@tcgmech.com', eligible: false, reason: 'exclusion_window', excluding_won_at: '2026-05-03T12:00:00Z' })
const rae = entry({ id: 'rae', full_name: 'Rae Gone', email: 'rae@thecomfortgroup.com', eligible: false, reason: 'removed', removed_at: '2026-10-08T15:00:00Z', removed_reason: 'test entry' })

function serve({ raffle = RAFFLE as Record<string, unknown> | null, entries = [jim, james, tom, rae], flags = pair('same_device', jim, james) } = {}) {
  fake.onTable('raffles', () => fake.ok(raffle))
  fake.onRpc('admin_entries', () => fake.ok(entries))
  fake.onRpc('admin_entry_flags', () => fake.ok(flags))
}

const rpcCalls = (fn: string) => fake.supabase.rpc.mock.calls.filter(([name]) => name === fn).map(([, args]) => args)

async function table() {
  return within(await screen.findByRole('table', { name: /entries/i }))
}

beforeEach(() => fake.reset())

describe('Entries tab (current Raffle)', () => {
  it('lists the Entries with flag pills, status and the added-by-admin marker', async () => {
    serve()
    renderAdmin('/admin/entries')
    expect(await screen.findByRole('heading', { name: 'Entries', level: 1 })).toBeInTheDocument()
    const t = await table()
    const jimRow = t.getByText('Jim Lee').closest('tr')!
    expect(within(jimRow).getByText('same device')).toHaveAttribute('title', 'Same device as James Lee')
    expect(within(jimRow).getByText('Eligible')).toBeInTheDocument()
    expect(within(t.getByText('James Lee').closest('tr')!).getByText('added by admin')).toBeInTheDocument()
    expect(within(t.getByText('Tom Baxter').closest('tr')!).getByText('Excluded: won May 3, 2026')).toBeInTheDocument()
    expect(t.getByText('Rae Gone').closest('tr')).toHaveClass('row--muted')
    expect(screen.getByText(/live preview/i)).toBeInTheDocument()
    expect(screen.getByText(/Titans vs\. Colts · 4 entries/)).toBeInTheDocument()
    expect(screen.getByText('· 2 flagged')).toBeInTheDocument()
  })

  it('says the Status is the Snapshot verdict after the Draw and hides Add/Remove', async () => {
    serve({
      raffle: { ...RAFFLE, state: 'drawn', status: 'drawn', drawn_at: '2026-10-21T15:00:00Z' },
      entries: [{ ...jim, status_source: 'snapshot' }],
      flags: [],
    })
    renderAdmin('/admin/entries')
    await table()
    expect(screen.getByText(/Draw Snapshot/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add entry' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Remove$/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
  })

  it('filters with chips and searches by name or email', async () => {
    serve()
    const user = userEvent.setup()
    renderAdmin('/admin/entries')
    await table()
    await user.click(screen.getByRole('button', { name: /^Flagged/ }))
    let t = await table()
    expect(t.getAllByRole('row')).toHaveLength(3) // header + Jim + James
    await user.click(screen.getByRole('button', { name: /^Removed/ }))
    t = await table()
    expect(t.getByText('Rae Gone')).toBeInTheDocument()
    expect(t.queryByText('Jim Lee')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Excluded/ }))
    expect((await table()).getByText('Tom Baxter')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^All/ }))
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'tcgmech')
    t = await table()
    expect(t.getAllByRole('row')).toHaveLength(2)
    expect(t.getByText('Tom Baxter')).toBeInTheDocument()
  })

  it('removes an Entry with a reason and reloads', async () => {
    serve()
    fake.onRpc('remove_entry', () => fake.ok(null))
    const user = userEvent.setup()
    renderAdmin('/admin/entries')
    const t = await table()
    await user.click(within(t.getByText('Jim Lee').closest('tr')!).getByRole('button', { name: 'Remove' }))
    const dialog = screen.getByRole('dialog', { name: /remove entry/i })
    const confirm = within(dialog).getByRole('button', { name: 'Remove entry' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/reason/i), 'duplicate')
    await user.click(confirm)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(rpcCalls('remove_entry')).toEqual([{ p_entry_id: 'jim', p_reason: 'duplicate' }])
    expect(rpcCalls('admin_entries').length).toBeGreaterThan(1)
  })

  it('restores a removed Entry', async () => {
    serve()
    fake.onRpc('restore_entry', () => fake.ok(null))
    const user = userEvent.setup()
    renderAdmin('/admin/entries')
    const t = await table()
    await user.click(within(t.getByText('Rae Gone').closest('tr')!).getByRole('button', { name: 'Restore' }))
    await waitFor(() => expect(rpcCalls('restore_entry')).toEqual([{ p_entry_id: 'rae' }]))
  })

  it('adds an Entry by hand', async () => {
    serve()
    fake.onRpc('add_entry', () => fake.ok('new-id'))
    const user = userEvent.setup()
    renderAdmin('/admin/entries')
    await table()
    await user.click(screen.getByRole('button', { name: 'Add entry' }))
    const dialog = screen.getByRole('dialog', { name: 'Add entry' })
    await user.type(within(dialog).getByLabelText('Full name'), ' Ana Diaz ')
    await user.type(within(dialog).getByLabelText('Work email'), 'adiaz@thecomfortgroup.com')
    await user.click(within(dialog).getByRole('button', { name: 'Add entry' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(rpcCalls('add_entry')).toEqual([{ p_raffle_id: 'r1', p_full_name: 'Ana Diaz', p_email: 'adiaz@thecomfortgroup.com' }])
  })

  it('says "already entered" and offers Restore when the existing Entry is removed', async () => {
    serve()
    fake.onRpc('add_entry', () => ({
      data: null, status: 409,
      error: { message: 'already_entered_removed', code: '23505', details: 'rae', hint: '' },
    }))
    fake.onRpc('restore_entry', () => fake.ok(null))
    const user = userEvent.setup()
    renderAdmin('/admin/entries')
    await table()
    await user.click(screen.getByRole('button', { name: 'Add entry' }))
    const dialog = screen.getByRole('dialog', { name: 'Add entry' })
    await user.type(within(dialog).getByLabelText('Full name'), 'Rae Gone')
    await user.type(within(dialog).getByLabelText('Work email'), 'rae@thecomfortgroup.com')
    await user.click(within(dialog).getByRole('button', { name: 'Add entry' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/already entered.*removed/i)
    await user.click(within(dialog).getByRole('button', { name: 'Restore instead?' }))
    await waitFor(() => expect(rpcCalls('restore_entry')).toEqual([{ p_entry_id: 'rae' }]))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('says "already entered" for an Entry that is still in', async () => {
    serve()
    fake.onRpc('add_entry', () => fake.dbError('already_entered', '23505', 409))
    const user = userEvent.setup()
    renderAdmin('/admin/entries')
    await table()
    await user.click(screen.getByRole('button', { name: 'Add entry' }))
    const dialog = screen.getByRole('dialog', { name: 'Add entry' })
    await user.type(within(dialog).getByLabelText('Full name'), 'Jim Lee')
    await user.type(within(dialog).getByLabelText('Work email'), 'jlee@thecomfortgroup.com')
    await user.click(within(dialog).getByRole('button', { name: 'Add entry' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Already entered in this raffle.')
    expect(within(dialog).queryByRole('button', { name: 'Restore instead?' })).not.toBeInTheDocument()
  })

  it('dismisses a flagged pair with a reason', async () => {
    serve()
    fake.onRpc('dismiss_flag', () => fake.ok('d1'))
    const user = userEvent.setup()
    renderAdmin('/admin/entries')
    const t = await table()
    await user.click(within(t.getByText('Jim Lee').closest('tr')!).getByRole('button', { name: /same device/ }))
    const dialog = screen.getByRole('dialog', { name: /dismiss/i })
    await user.type(within(dialog).getByLabelText(/reason/i), 'brothers, shared laptop')
    await user.click(within(dialog).getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(rpcCalls('dismiss_flag')).toEqual([
      { p_raffle_id: 'r1', p_rule: 'same_device', p_entry_a: 'jim', p_entry_b: 'james', p_reason: 'brothers, shared laptop' },
    ])
  })

  it('shows a dismissed marker under Flagged only', async () => {
    serve({ entries: [jim, james], flags: pair('same_device', jim, james, { dismissed: true }) })
    const user = userEvent.setup()
    renderAdmin('/admin/entries')
    await table()
    expect(screen.queryByText(/dismissed/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Flagged/ }))
    expect((await table()).getAllByText(/same device dismissed/)).toHaveLength(2)
  })

  it('shows a grey "pair removed" pill when the other Entry is removed', async () => {
    const gone = { ...james, removed_at: '2026-10-08T15:00:00Z', removed_reason: 'dup', eligible: false, reason: 'removed' as const }
    serve({ entries: [jim, gone], flags: pair('same_device', jim, gone) })
    renderAdmin('/admin/entries')
    const t = await table()
    const pill = within(t.getByText('Jim Lee').closest('tr')!).getByRole('button', { name: /same device/ })
    expect(pill).toHaveClass('flag--removed')
    expect(pill).toHaveTextContent('pair removed')
  })

  it('exports the filtered view as CSV', async () => {
    serve()
    const created: Blob[] = []
    URL.createObjectURL = vi.fn((b: Blob) => (created.push(b), 'blob:x'))
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const user = userEvent.setup()
    renderAdmin('/admin/entries')
    await table()
    await user.click(screen.getByRole('button', { name: /^Flagged/ }))
    await user.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(click).toHaveBeenCalled()
    const bytes = new Uint8Array(await created[0].arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]) // UTF-8 BOM for Excel
    const lines = new TextDecoder().decode(bytes).trim().split('\r\n')
    expect(lines[0]).toBe('name,email,entered_at,status,flags,removed_at,removed_reason,device_id')
    expect(lines.slice(1).map((l) => l.split(',')[0])).toEqual(['Jim Lee', 'James Lee'])
    expect(lines[1]).toContain(',same_device,')
    click.mockRestore()
  })

  it('shows the share link when there are no entries yet', async () => {
    serve({ entries: [], flags: [] })
    renderAdmin('/admin/entries')
    expect(await screen.findByText('No entries yet, share the link')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /public link/i })).toHaveValue(`${window.location.origin}${import.meta.env.BASE_URL}`)
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
  })

  it('says so when there is no raffle', async () => {
    serve({ raffle: null })
    renderAdmin('/admin/entries')
    expect(await screen.findByText('No raffle yet')).toBeInTheDocument()
  })
})

describe('another Raffle\'s Entries (/admin/entries/:raffleId)', () => {
  it('is read-mostly: search and export, no Add/Remove/Restore', async () => {
    serve({ raffle: { ...RAFFLE, id: 'old', state: 'drawn', status: 'drawn', drawn_at: '2026-09-01T12:00:00Z' } })
    renderAdmin('/admin/entries/old')
    const t = await table()
    expect(rpcCalls('admin_entries')).toEqual([{ p_raffle_id: 'old' }])
    expect(screen.queryByRole('button', { name: 'Add entry' })).not.toBeInTheDocument()
    expect(t.queryByRole('button', { name: /^(Remove|Restore)$/ })).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: /search/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /raffle details/i })).toHaveAttribute('href', '/admin/history/old')
  })

  it('is read-mostly even for an Open Raffle opened by id', async () => {
    serve()
    renderAdmin('/admin/entries/r1')
    const t = await table()
    expect(screen.queryByRole('button', { name: 'Add entry' })).not.toBeInTheDocument()
    expect(t.queryByRole('button', { name: /^(Remove|Restore)$/ })).not.toBeInTheDocument()
  })

  it('says when the Raffle does not exist', async () => {
    serve({ raffle: null })
    renderAdmin('/admin/entries/nope')
    expect(await screen.findByText('Raffle not found')).toBeInTheDocument()
  })
})
