import { useDatabaseStatus } from '../data/DatabaseStatus'

export const UNREACHABLE_MESSAGE =
  "Can't reach the database. If the project is paused, resume it in Supabase."

/** Persistent banner above the tab content while any call reports `unreachable`. */
export function DatabaseBanner() {
  const { unreachable, retry } = useDatabaseStatus()
  if (!unreachable) return null
  return (
    <div className="db-banner" role="alert">
      <span>{UNREACHABLE_MESSAGE}</span>
      <button type="button" className="btn btn--outline db-banner__retry" onClick={retry}>
        Retry
      </button>
    </div>
  )
}
