import { EmptyState, PageHeader, Panel } from '../ui'

/**
 * Dashboard tab, routed at /admin/dashboard/* (this folder is owned by #13).
 * Placeholder: replace freely. Nested routes go in a <Routes> here, relative to /admin/dashboard.
 */
export function DashboardTab() {
  return (
    <>
      <PageHeader title="Dashboard" lead="What's open now, who won last, and start the next one." />
      <Panel>
        <EmptyState title="Coming soon">This tab is built in #13.</EmptyState>
      </Panel>
    </>
  )
}
