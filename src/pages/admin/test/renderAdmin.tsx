import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { fake } from '../../../test/fakeSupabase'
import { AdminApp } from '../AdminApp'

function Location() {
  return <output data-testid="admin-location">{useLocation().pathname}</output>
}

/**
 * Mount the whole admin panel at `path` (e.g. '/admin/entries'), signed in by default.
 * The calling test file must mock the client:
 *   vi.mock('<relative>/lib/supabase', () => import('<relative>/test/fakeSupabase'))
 */
export function renderAdmin(path = '/admin', { signedIn = true }: { signedIn?: boolean } = {}) {
  if (signedIn) fake.signedIn()
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
      <Location />
    </MemoryRouter>,
  )
}

/** The router's current pathname inside a `renderAdmin` tree. */
export function currentPath(): string | null {
  return screen.getByTestId('admin-location').textContent
}
