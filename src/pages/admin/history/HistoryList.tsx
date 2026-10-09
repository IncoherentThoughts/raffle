import { Link } from 'react-router-dom'
import { listHistory, type HistoryRaffle } from '../../../lib/api/history'
import { useAdminQuery } from '../data/useAdminQuery'
import { DataTable, EmptyState, InlineError, Loading, PageHeader, Panel, Tag, type Column } from '../ui'
import { EntriesChart } from './EntriesChart'
import { formatDate } from './model'

const columns: Column<HistoryRaffle>[] = [
  {
    key: 'title',
    header: 'Title',
    className: 'name',
    render: (r) => (
      <Link className="history-link" to={`/admin/history/${r.id}`}>
        {r.title}
      </Link>
    ),
  },
  { key: 'opened', header: 'Opened', className: 'num', render: (r) => formatDate(r.openedAt) },
  { key: 'closed', header: 'Closed', className: 'num', render: (r) => formatDate(r.closeTime) },
  {
    key: 'ended',
    header: 'Drawn / Cancelled',
    render: (r) =>
      r.state === 'drawn' ? (
        <span className="history-ended">
          <Tag tone="gold">Drawn</Tag> <span className="num">{formatDate(r.endedAt)}</span>
        </span>
      ) : (
        <span className="history-ended" title={r.cancelReason ?? undefined}>
          <Tag tone="red">Cancelled</Tag> <span className="num">{formatDate(r.endedAt)}</span>
        </span>
      ),
  },
  {
    key: 'entries',
    header: 'Entries (eligible / excluded)',
    className: 'num',
    render: (r) =>
      r.eligible === null ? r.entries : `${r.entries} (${r.eligible} / ${r.excluded ?? 0})`,
  },
  {
    key: 'winners',
    header: 'Winners',
    className: 'num',
    render: (r) =>
      r.state === 'cancelled' ? '—' : (
        <>
          {r.winners} of {r.winnerCount}
          {r.vacant > 0 && <span className="history-muted"> ({r.vacant} vacant)</span>}
        </>
      ),
  },
  { key: 'redraws', header: 'Redraws', className: 'num', render: (r) => (r.state === 'cancelled' ? '—' : r.redraws) },
]

/** /admin/history: entries-per-Raffle chart and one row per Drawn or Cancelled Raffle. */
export function HistoryList() {
  const { data, error, loading } = useAdminQuery(listHistory, [])
  return (
    <>
      <PageHeader
        title="History"
        lead="Every drawn or cancelled raffle, kept indefinitely."
        actions={
          <Link className="btn btn--outline" to="/admin/history/activity">
            Activity log
          </Link>
        }
      />
      {error && <InlineError>{`Couldn't load the history (${error.message}).`}</InlineError>}
      {!data && loading && <Loading />}
      {data && data.length === 0 && (
        <Panel>
          <EmptyState title="No completed raffles yet">Drawn and cancelled raffles appear here.</EmptyState>
        </Panel>
      )}
      {data && data.length > 0 && (
        <>
          <Panel title="Entries per raffle">
            <EntriesChart raffles={data} />
          </Panel>
          <Panel title="Completed raffles" className="history-table">
            <DataTable
              caption="Completed raffles"
              columns={columns}
              rows={data}
              rowKey={(r) => r.id}
            />
          </Panel>
        </>
      )}
    </>
  )
}
