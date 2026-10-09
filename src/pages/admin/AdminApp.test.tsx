import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ADMIN_EMAIL, ADMIN_PASSWORD, fake } from '../../test/fakeSupabase'
import { currentPath as path, renderAdmin } from './test/renderAdmin'

vi.mock('../../lib/supabase', () => import('../../test/fakeSupabase'))

// Each test sets up its own session state (fake.signedIn()) before rendering.
const renderAt = (route = '/admin') => renderAdmin(route, { signedIn: false })

async function signInAs(username: string, password: string) {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Username'), username)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  return user
}

beforeEach(() => {
  fake.reset()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('login', () => {
  it('shows the sign-in card at /admin when signed out', async () => {
    renderAt()
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('signs in with the admin email as username and lands on the Dashboard', async () => {
    renderAt()
    await signInAs(ADMIN_EMAIL, ADMIN_PASSWORD)
    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument()
    expect(path()).toBe('/admin/dashboard')
    expect(fake.supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    })
  })

  it('shows an inline error and stays on the card for a wrong password', async () => {
    renderAt()
    await signInAs(ADMIN_EMAIL, 'wrong')
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password.')
    expect(screen.getByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument()
  })

  it('tells the admin to wait when Supabase rate-limits sign-in', async () => {
    fake.onSignIn(() => ({
      data: { session: null, user: null },
      error: { message: 'Too many requests', status: 429 },
      status: 429,
    }))
    renderAt()
    await signInAs(ADMIN_EMAIL, 'x')
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many sign-in attempts/i)
  })

  it('keeps the requested tab after signing in from a deep link', async () => {
    renderAt('/admin/winners')
    await signInAs(ADMIN_EMAIL, ADMIN_PASSWORD)
    expect(await screen.findByRole('heading', { name: 'Winners', level: 1 })).toBeInTheDocument()
    expect(path()).toBe('/admin/winners')
  })
})

describe('shell', () => {
  it('restores a persisted session and redirects /admin to the Dashboard', async () => {
    fake.signedIn()
    renderAt('/admin')
    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument()
    expect(path()).toBe('/admin/dashboard')
  })

  it('switches tabs from the sidebar', async () => {
    fake.signedIn()
    renderAt('/admin/dashboard')
    const user = userEvent.setup()
    const nav = await screen.findByRole('navigation', { name: 'Admin' })
    for (const tab of ['Entries', 'Winners', 'History', 'Dashboard']) {
      await user.click(within(nav).getByRole('link', { name: tab }))
      expect(await screen.findByRole('heading', { name: tab, level: 1 })).toBeInTheDocument()
      expect(within(nav).getByRole('link', { name: tab })).toHaveAttribute('aria-current', 'page')
    }
    expect(path()).toBe('/admin/dashboard')
  })

  it('opens Settings with the Export all data button', async () => {
    fake.signedIn()
    renderAt('/admin/dashboard')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('link', { name: 'Settings' }))
    expect(await screen.findByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export all data' })).toBeInTheDocument()
    expect(path()).toBe('/admin/settings')
  })

  it('signs out back to the login card, for this browser only', async () => {
    fake.signedIn()
    renderAt('/admin/entries')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument()
    expect(fake.supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(path()).toBe('/admin')
  })

  it('returns to the login card when the session ends elsewhere', async () => {
    fake.signedIn()
    renderAt('/admin/dashboard')
    await screen.findByRole('heading', { name: 'Dashboard', level: 1 })
    fake.expireSession()
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument()
  })

  it('signs out with a notice when the server says the account is not the admin', async () => {
    fake.signedIn('someone-else@example.test')
    fake.onRpc('keepalive', () => fake.dbError('not_admin', '42501'))
    renderAt('/admin/dashboard')
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument()
    expect(screen.getByText(/not the raffle admin/i)).toBeInTheDocument()
  })
})

describe('database banner', () => {
  const BANNER = "Can't reach the database. If the project is paused, resume it in Supabase."

  it('shows the banner when the database is unreachable and clears it on a successful Retry', async () => {
    fake.signedIn()
    fake.onRpc('keepalive', () => fake.unreachable())
    renderAt('/admin/dashboard')
    expect(await screen.findByRole('alert')).toHaveTextContent(BANNER)

    fake.onRpc('keepalive', () => fake.ok('2026-10-08T00:00:00Z'))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.queryByText(BANNER)).not.toBeInTheDocument())
    expect(fake.supabase.rpc).toHaveBeenCalledTimes(2)
  })

  it('keeps the banner when Retry fails again', async () => {
    fake.signedIn()
    fake.onRpc('keepalive', () => fake.unreachable())
    renderAt('/admin/dashboard')
    await screen.findByRole('alert')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(fake.supabase.rpc).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('alert')).toHaveTextContent(BANNER)
  })

  it('shows no banner when the database answers', async () => {
    fake.signedIn()
    renderAt('/admin/dashboard')
    await screen.findByRole('heading', { name: 'Dashboard', level: 1 })
    await waitFor(() => expect(fake.supabase.rpc).toHaveBeenCalledWith('keepalive', undefined))
    expect(screen.queryByText(BANNER)).not.toBeInTheDocument()
  })

  it('explains an unreachable database on the login card', async () => {
    fake.onSignIn(() => ({
      data: { session: null, user: null },
      error: { message: 'Failed to fetch', status: 0 },
      status: 0,
    }))
    renderAt()
    await signInAs(ADMIN_EMAIL, ADMIN_PASSWORD)
    expect(await screen.findByRole('alert')).toHaveTextContent(BANNER)
  })
})

describe('theme', () => {
  it('toggles data-theme on <html> and remembers the choice', async () => {
    fake.signedIn()
    const { unmount } = renderAt('/admin/dashboard')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Dark theme' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: 'Light theme' })).toBeInTheDocument()
    unmount()

    document.documentElement.removeAttribute('data-theme')
    renderAt('/admin/dashboard')
    expect(await screen.findByRole('button', { name: 'Light theme' })).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('still toggles when localStorage is blocked', async () => {
    fake.signedIn()
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    renderAt('/admin/dashboard')
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Dark theme' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    spy.mockRestore()
  })
})
