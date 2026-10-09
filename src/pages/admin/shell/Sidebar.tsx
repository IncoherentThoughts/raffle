import { useState, type ComponentType } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAdminSession } from '../session/AdminSession'
import { DashboardIcon, EntriesIcon, HistoryIcon, MenuIcon, WinnersIcon } from './icons'
import type { Theme } from './useTheme'

/** The four main tabs. Paths are relative to /admin. */
export const TABS: { path: string; label: string; Icon: ComponentType }[] = [
  { path: 'dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { path: 'entries', label: 'Entries', Icon: EntriesIcon },
  { path: 'winners', label: 'Winners', Icon: WinnersIcon },
  { path: 'history', label: 'History', Icon: HistoryIcon },
]

const tabClass = ({ isActive }: { isActive: boolean }) => `side__tab${isActive ? ' is-active' : ''}`

/**
 * Navy sidebar: four tabs, then a smaller utility group (Theme, Settings, Sign out).
 * Below 900px (admin.css) it becomes a top bar with the tabs and a Menu button that
 * reveals the utility group.
 */
export function Sidebar({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const { signOut } = useAdminSession()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  async function handleSignOut() {
    closeMenu()
    await signOut()
    navigate('/admin', { replace: true })
  }

  return (
    <aside className="side">
      <p className="side__section">Admin</p>
      <nav aria-label="Admin" className="side__tabs">
        {TABS.map(({ path, label, Icon }) => (
          <NavLink key={path} to={`/admin/${path}`} className={tabClass} onClick={closeMenu}>
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <button
        type="button"
        className="side__menu-button"
        aria-expanded={menuOpen}
        aria-controls="admin-utilities"
        onClick={() => setMenuOpen((o) => !o)}
      >
        <MenuIcon />
        <span className="visually-hidden">Menu</span>
      </button>
      <div id="admin-utilities" className={`side__utils${menuOpen ? ' is-open' : ''}`}>
        <button type="button" className="side__util" onClick={onToggleTheme}>
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </button>
        <NavLink
          to="/admin/settings"
          className={({ isActive }) => `side__util${isActive ? ' is-active' : ''}`}
          onClick={closeMenu}
        >
          Settings
        </NavLink>
        <button type="button" className="side__util" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </aside>
  )
}
