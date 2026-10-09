import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listActivity } from '../../../lib/api/history'
import { useAdminQuery } from '../data/useAdminQuery'
import { Button, InlineError, Loading, PageHeader, Panel } from '../ui'
import { ActivityTable } from './ActivityTable'

export const ACTIVITY_PAGE_SIZE = 100

/** /admin/history/activity: every Admin action, newest first. */
export function ActivityLogPage() {
  const [limit, setLimit] = useState(ACTIVITY_PAGE_SIZE)
  const { data, error, loading } = useAdminQuery(() => listActivity(limit), [limit])
  return (
    <>
      <p className="history-back">
        <Link to="/admin/history">← History</Link>
      </p>
      <PageHeader title="Activity log" lead="Every admin action, newest first. Kept permanently." />
      {error && <InlineError>{`Couldn't load the activity log (${error.message}).`}</InlineError>}
      {!data && loading && <Loading />}
      {data && (
        <Panel>
          <ActivityTable rows={data.rows} withRaffle />
          {data.more && (
            <div className="history-more">
              <Button variant="outline" disabled={loading} onClick={() => setLimit((n) => n + ACTIVITY_PAGE_SIZE)}>
                {loading ? 'Loading…' : 'Show older'}
              </Button>
            </div>
          )}
        </Panel>
      )}
    </>
  )
}
