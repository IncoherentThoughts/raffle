import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'
import { fake } from './test/fakeSupabase'

vi.mock('./lib/supabase', () => import('./test/fakeSupabase'))

beforeEach(() => {
  fake.reset()
  fake.onRpc('public_raffle_state', () => fake.ok([{ status: 'none', winner_names: [] }]))
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('routes', () => {
  it('renders the public page at /', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { name: 'Nothing to enter yet' })).toBeInTheDocument()
  })

  it('renders the admin sign-in at /admin', async () => {
    renderAt('/admin')
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument()
  })
})
