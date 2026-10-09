import { EmptyState, PageHeader, Panel } from '../ui'

/**
 * History tab, routed at /admin/history/* (this folder is owned by #16).
 * Placeholder: replace freely. Nested routes go in a <Routes> here, relative to /admin/history.
 */
export function HistoryTab() {
  return (
    <>
      <PageHeader title="History" lead="Every drawn or cancelled raffle, kept indefinitely." />
      <Panel>
        <EmptyState title="Coming soon">This tab is built in #16.</EmptyState>
      </Panel>
    </>
  )
}
