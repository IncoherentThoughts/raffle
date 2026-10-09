import { useState } from 'react'
import { exportAllData } from '../../../lib/api/export'
import { useApiErrorHandler } from '../data/useAdminQuery'
import { Button, InlineError, PageHeader, Panel } from '../ui'

/**
 * Settings, routed at /admin/settings. Only "Export all data" (#6, #17): a zip with one CSV
 * per table (device_id included).
 */
export function SettingsTab() {
  const handleError = useApiErrorHandler()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function runExport() {
    setBusy('Preparing…')
    setError(null)
    setDone(null)
    try {
      setDone(await exportAllData((table) => setBusy(`Exporting ${table.replace(/_/g, ' ')}…`)))
    } catch (e) {
      // Unreachable and not-admin are handled by the shell; only business errors come back.
      const err = handleError(e)
      if (err) setError(`Export failed: ${err.message}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader title="Settings" />
      <Panel title="Export all data">
        <p className="panel__text">
          Download a zip with one CSV per table: raffles, entries, winners, draw snapshots,
          overrides, flag dismissals and the activity log. It contains names, emails and device
          ids, so keep it somewhere private. Export monthly as a backup.
        </p>
        {error && <InlineError>{error}</InlineError>}
        <Button variant="outline" onClick={runExport} disabled={busy !== null}>
          {busy ?? 'Export all data'}
        </Button>
        {done && (
          <p className="panel__text" role="status">
            Downloaded {done}.
          </p>
        )}
      </Panel>
    </>
  )
}
