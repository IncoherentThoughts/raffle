import { Button, PageHeader, Panel } from '../ui'

/**
 * Settings, routed at /admin/settings. Only "Export all data" (#6): a zip with one CSV per
 * table (raffles, entries, winners, draw_snapshots, overrides, activity_log), device_id
 * included. The export itself is built later; wire it to the button below.
 */
export function SettingsTab() {
  return (
    <>
      <PageHeader title="Settings" />
      <Panel title="Export all data">
        <p className="panel__text">
          Download a zip with one CSV per table: raffles, entries, winners, draw snapshots,
          overrides and the activity log. It contains names and emails, so keep it somewhere
          private. Export monthly as a backup.
        </p>
        <Button variant="outline" disabled title="Coming soon">
          Export all data
        </Button>
      </Panel>
    </>
  )
}
