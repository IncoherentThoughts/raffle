import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('routes', () => {
  it('renders the public page at /', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'Coming soon' })).toBeInTheDocument()
  })

  it('renders the admin page at /admin', () => {
    renderAt('/admin')
    expect(screen.getByRole('heading', { name: 'Admin' })).toBeInTheDocument()
  })
})
