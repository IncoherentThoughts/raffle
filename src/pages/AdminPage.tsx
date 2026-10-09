import { lazy, Suspense } from 'react'

// The admin panel lives in src/pages/admin/ (see its README). Lazy-loaded so the public
// page's bundle doesn't carry it.
const AdminApp = lazy(() => import('./admin/AdminApp').then((m) => ({ default: m.AdminApp })))

export function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminApp />
    </Suspense>
  )
}
