import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PublicPage } from './PublicPage'

vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }))

const rpc = vi.mocked(supabase.rpc)
const from = vi.mocked(supabase.from)

type State = {
  raffle_id: string | null
  title: string | null
  prize: string | null
  details: string | null
  close_time: string | null
  status: 'open' | 'closed' | 'drawn' | 'none'
  winner_names: string[]
}

const RAFFLE_ID = '11111111-2222-4333-8444-555555555555'
const NONE: State = {
  raffle_id: null, title: null, prize: null, details: null, close_time: null, status: 'none', winner_names: [],
}

function raffle(overrides: Partial<State> = {}): State {
  return {
    raffle_id: RAFFLE_ID,
    title: 'Titans vs. Colts: Two Tickets',
    prize: '2 lower-bowl seats',
    details: 'Open to all Comfort Group employees.',
    close_time: new Date(Date.now() + 2 * 86400_000 + 14 * 3600_000 + 60_000).toISOString(),
    status: 'open',
    winner_names: [],
    ...overrides,
  }
}

type Result = { data?: unknown; error: unknown; status?: number }

function stateReturns(...states: (State | Result)[]) {
  for (const s of states) {
    const result = 'status' in s && typeof s.status === 'string' ? { data: [s], error: null } : s
    rpc.mockResolvedValueOnce(result as never)
  }
}

let insert: ReturnType<typeof vi.fn>
function insertReturns(result: Result) {
  insert.mockResolvedValueOnce(result)
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PublicPage />
    </MemoryRouter>,
  )
}

const NETWORK_ERROR = { error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0, data: null }

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  rpc.mockReset()
  insert = vi.fn()
  from.mockReset().mockReturnValue({ insert } as never)
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

function user() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

async function fillAndSubmit(name = 'Dakota Worthen', email = 'dworthen@thecomfortgroup.com') {
  const u = user()
  await u.type(screen.getByLabelText('Full Name'), name)
  await u.type(screen.getByLabelText('Work Email'), email)
  await u.click(screen.getByRole('button', { name: 'Enter Raffle' }))
}

describe('PublicPage', () => {
  it('shows an empty state when there is no raffle', async () => {
    stateReturns(NONE)
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Nothing to enter yet' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('public_raffle_state')
  })

  describe('open raffle', () => {
    it('shows the title, prize, details, time left and the entry form', async () => {
      stateReturns(raffle())
      renderPage()
      expect(await screen.findByRole('heading', { name: 'Titans vs. Colts: Two Tickets' })).toBeInTheDocument()
      expect(screen.getByText('2 lower-bowl seats')).toBeInTheDocument()
      expect(screen.getByText('Open to all Comfort Group employees.')).toBeInTheDocument()
      expect(screen.getByText('2 days 14 hrs')).toBeInTheDocument()
      expect(screen.getByLabelText('Full Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Work Email')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Enter Raffle' })).toBeInTheDocument()
    })

    it('carries the device-ID notice', async () => {
      stateReturns(raffle())
      renderPage()
      expect(
        await screen.findByText('We store a random ID in your browser to help spot duplicate entries.'),
      ).toBeInTheDocument()
    })

    it('omits the prize when there is none', async () => {
      stateReturns(raffle({ prize: null, details: null }))
      renderPage()
      await screen.findByRole('heading', { name: 'Titans vs. Colts: Two Tickets' })
      expect(screen.queryByText('Prize')).not.toBeInTheDocument()
    })

    it('switches to Closed when the countdown reaches zero', async () => {
      stateReturns(raffle({ close_time: new Date(Date.now() + 3000).toISOString() }))
      renderPage()
      await screen.findByLabelText('Full Name')
      // Async advance lets React flush the countdown's effect before its interval is due.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000)
      })
      expect(await screen.findByRole('heading', { name: 'Drawing soon' })).toBeInTheDocument()
      expect(screen.queryByLabelText('Full Name')).not.toBeInTheDocument()
    })
  })

  describe('entering', () => {
    it('inserts the entry with the device ID and shows a success note', async () => {
      stateReturns(raffle())
      insertReturns({ error: null, status: 201 })
      renderPage()
      await screen.findByLabelText('Full Name')
      await fillAndSubmit()
      expect(await screen.findByRole('heading', { name: /you.re entered/i })).toBeInTheDocument()
      expect(from).toHaveBeenCalledWith('entries')
      expect(insert).toHaveBeenCalledWith({
        raffle_id: RAFFLE_ID,
        full_name: 'Dakota Worthen',
        email: 'dworthen@thecomfortgroup.com',
        device_id: localStorage.getItem('raffle_device_id'),
      })
      expect(localStorage.getItem('raffle_device_id')).toMatch(/^[0-9a-f-]{36}$/)
    })

    it('says "already entered" on a duplicate', async () => {
      stateReturns(raffle())
      insertReturns({ error: { code: '23505', message: 'duplicate key' }, status: 409 })
      renderPage()
      await screen.findByLabelText('Full Name')
      await fillAndSubmit()
      expect(await screen.findByRole('heading', { name: 'Already entered' })).toBeInTheDocument()
      expect(screen.getByText('dworthen@thecomfortgroup.com')).toBeInTheDocument()
    })

    it('refreshes to Closed when the raffle stopped taking entries', async () => {
      stateReturns(raffle(), raffle({ status: 'closed' }))
      insertReturns({ error: { code: '42501', message: 'new row violates row-level security policy' }, status: 401 })
      renderPage()
      await screen.findByLabelText('Full Name')
      await fillAndSubmit()
      expect(await screen.findByRole('heading', { name: 'Drawing soon' })).toBeInTheDocument()
    })

    it('asks for a valid name and email when the server rejects them', async () => {
      stateReturns(raffle())
      insertReturns({ error: { code: '23514', message: 'violates check constraint' }, status: 400 })
      renderPage()
      await screen.findByLabelText('Full Name')
      await fillAndSubmit('Dakota Worthen', 'd@x.co')
      expect(await screen.findByRole('alert')).toHaveTextContent(/full name and a valid email/i)
      expect(screen.getByLabelText('Work Email')).toHaveValue('d@x.co')
    })

    it('does not submit a blank name', async () => {
      stateReturns(raffle())
      renderPage()
      await screen.findByLabelText('Full Name')
      await fillAndSubmit('   ', 'dworthen@thecomfortgroup.com')
      expect(insert).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent(/full name/i)
    })

    it('does not submit a malformed email', async () => {
      stateReturns(raffle())
      renderPage()
      await screen.findByLabelText('Full Name')
      await fillAndSubmit('Dakota Worthen', 'dworthen')
      expect(insert).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent(/email/i)
    })

    it('explains a rate limit', async () => {
      stateReturns(raffle())
      insertReturns({ error: { code: 'PT429', message: 'rate_limited' }, status: 429 })
      renderPage()
      await screen.findByLabelText('Full Name')
      await fillAndSubmit()
      expect(await screen.findByRole('alert')).toHaveTextContent(/too many/i)
    })

    it('keeps the form filled in when the server cannot be reached', async () => {
      stateReturns(raffle())
      insertReturns(NETWORK_ERROR)
      renderPage()
      await screen.findByLabelText('Full Name')
      await fillAndSubmit()
      expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t reach/i)
      expect(screen.getByLabelText('Full Name')).toHaveValue('Dakota Worthen')
      expect(screen.getByRole('button', { name: 'Enter Raffle' })).toBeEnabled()
    })
  })

  it('says entries are closed for a closed raffle', async () => {
    stateReturns(raffle({ status: 'closed', close_time: new Date(Date.now() - 60_000).toISOString() }))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Drawing soon' })).toBeInTheDocument()
    expect(screen.getByText(/entries closed .*posted here/i)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  describe('drawn raffle', () => {
    it('congratulates the winner', async () => {
      stateReturns(raffle({ status: 'drawn', winner_names: ['Dakota Worthen'] }))
      renderPage()
      expect(await screen.findByRole('heading', { name: 'Congratulations to Dakota Worthen' })).toBeInTheDocument()
      expect(screen.getByText(/check back soon for a new raffle/i)).toBeInTheDocument()
    })

    it('lists several winners', async () => {
      stateReturns(raffle({ status: 'drawn', winner_names: ['Ana Kowalski', 'Tom Baxter', 'Sam Rivers'] }))
      renderPage()
      expect(
        await screen.findByRole('heading', { name: 'Congratulations to Ana Kowalski, Tom Baxter and Sam Rivers' }),
      ).toBeInTheDocument()
    })

    it('still reads sensibly when every winner slot is vacant', async () => {
      stateReturns(raffle({ status: 'drawn', winner_names: [] }))
      renderPage()
      expect(await screen.findByText(/check back soon for a new raffle/i)).toBeInTheDocument()
      expect(screen.queryByText(/congratulations to/i)).not.toBeInTheDocument()
    })
  })

  describe('cannot reach the server', () => {
    it('offers to try again and recovers', async () => {
      stateReturns(NETWORK_ERROR, raffle())
      renderPage()
      expect(await screen.findByRole('heading', { name: /can.t reach the raffle/i })).toBeInTheDocument()
      await user().click(screen.getByRole('button', { name: 'Try again' }))
      expect(await screen.findByLabelText('Full Name')).toBeInTheDocument()
    })
  })

  it('picks up a Draw while the page is open', async () => {
    stateReturns(raffle({ status: 'closed' }), raffle({ status: 'drawn', winner_names: ['Dakota Worthen'] }))
    renderPage()
    await screen.findByRole('heading', { name: 'Drawing soon' })
    await act(async () => {
      vi.advanceTimersByTime(61_000)
    })
    expect(await screen.findByRole('heading', { name: 'Congratulations to Dakota Worthen' })).toBeInTheDocument()
  })
})
