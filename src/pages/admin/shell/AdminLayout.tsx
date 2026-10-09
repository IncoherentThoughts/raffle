import { Outlet } from 'react-router-dom'
import { HeaderBar } from '../../../components/HeaderBar'
import { ping } from '../../../lib/api'
import { useAdminQuery } from '../data/useAdminQuery'
import { DatabaseBanner } from './DatabaseBanner'
import { Sidebar } from './Sidebar'
import type { Theme } from './useTheme'

/** Signed-in frame: brand bar, navy sidebar, banner, and the active tab in <Outlet />. */
export function AdminLayout({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  // Health check on entry and on every Retry, so the banner shows even on a quiet tab.
  useAdminQuery(ping, [])

  return (
    <>
      <HeaderBar />
      <div className="shell">
        <Sidebar theme={theme} onToggleTheme={onToggleTheme} />
        <main className="shell__main">
          <DatabaseBanner />
          <Outlet />
        </main>
      </div>
    </>
  )
}
