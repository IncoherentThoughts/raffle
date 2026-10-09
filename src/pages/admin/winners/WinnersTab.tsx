import { EmptyState, PageHeader, Panel } from '../ui'

/**
 * Winners tab, routed at /admin/winners/* (this folder is owned by #15).
 * Placeholder: replace freely. Nested routes go in a <Routes> here, relative to /admin/winners.
 */
export function WinnersTab() {
  return (
    <>
      <PageHeader title="Winners" lead="Standing and past winners, and eligibility overrides." />
      <Panel>
        <EmptyState title="Coming soon">This tab is built in #15.</EmptyState>
      </Panel>
    </>
  )
}
