import { Navigate, Route, Routes } from 'react-router-dom'
import './admin.css'
import { DashboardTab } from './dashboard/DashboardTab'
import { DatabaseStatusProvider } from './data/DatabaseStatus'
import { EntriesTab } from './entries/EntriesTab'
import { HistoryTab } from './history/HistoryTab'
import { LoginPage } from './login/LoginPage'
import { AdminSessionProvider, useAdminSession } from './session/AdminSession'
import { SettingsTab } from './settings/SettingsTab'
import { AdminLayout } from './shell/AdminLayout'
import { useTheme, type Theme } from './shell/useTheme'
import { WinnersTab } from './winners/WinnersTab'

/** The admin panel, mounted at /admin/*. */
export function AdminApp() {
  const { theme, toggle } = useTheme()
  return (
    <div className="admin">
      <AdminSessionProvider>
        <DatabaseStatusProvider>
          <Gate theme={theme} onToggleTheme={toggle} />
        </DatabaseStatusProvider>
      </AdminSessionProvider>
    </div>
  )
}

function Gate({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const { status } = useAdminSession()
  if (status === 'loading') return null
  // Signed out: the login card at whatever /admin/* path was requested, so a deep link
  // lands on its tab after sign-in.
  if (status === 'signedOut') return <LoginPage />
  return (
    <Routes>
      <Route element={<AdminLayout theme={theme} onToggleTheme={onToggleTheme} />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard/*" element={<DashboardTab />} />
        <Route path="entries/*" element={<EntriesTab />} />
        <Route path="winners/*" element={<WinnersTab />} />
        <Route path="history/*" element={<HistoryTab />} />
        <Route path="settings" element={<SettingsTab />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  )
}
