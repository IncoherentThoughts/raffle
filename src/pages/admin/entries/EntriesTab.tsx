import { EmptyState, PageHeader, Panel } from '../ui'

/**
 * Entries tab, routed at /admin/entries/* (this folder is owned by #14).
 * Placeholder: replace freely. Nested routes go in a <Routes> here, relative to /admin/entries.
 */
export function EntriesTab() {
  return (
    <>
      <PageHeader title="Entries" lead="Entries for the current raffle." />
      <Panel>
        <EmptyState title="Coming soon">This tab is built in #14.</EmptyState>
      </Panel>
    </>
  )
}
