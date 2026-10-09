import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'

vi.mock('./lib/supabase', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: [{ status: 'none', winner_names: [] }], error: null }),
    from: vi.fn(),
  },
}))

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

  it('renders the admin page at /admin', () => {
    renderAt('/admin')
    expect(screen.getByRole('heading', { name: 'Admin' })).toBeInTheDocument()
  })
})
