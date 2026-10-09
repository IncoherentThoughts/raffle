import { Route, Routes } from 'react-router-dom'
import { PublicPage } from './pages/PublicPage'
import { AdminPage } from './pages/AdminPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicPage />} />
      <Route path="/admin/*" element={<AdminPage />} />
      <Route path="*" element={<PublicPage />} />
    </Routes>
  )
}
