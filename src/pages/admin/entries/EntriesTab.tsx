import { useMemo, useState } from 'react'
import { Link, Route, Routes, useParams } from 'react-router-dom'
import type { ApiError } from '../../../lib/api'
import {
  currentEntriesRaffle,
  getEntriesRaffle,
  listEntries,
  listEntryFlags,
  removeEntry,
  restoreEntry,
  type EntriesRaffle,
} from '../../../lib/api/entries'
import { useAdminQuery, useApiErrorHandler } from '../data/useAdminQuery'
import { Button, ConfirmDialog, DataTable, EmptyState, InlineError, Loading, PageHeader, Panel, Tag, type Column } from '../ui'
import { AddEntryModal } from './AddEntryModal'
import { DismissFlagDialog, type DismissTarget } from './DismissFlagDialog'
import './entries.css'
import { friendlyEntryError } from './errors'
import {
  buildRows,
  filterCounts,
  filterRows,
  formatDateTime,
  toCsv,
  type EntriesFilter,
  type EntryRow,
} from './entriesModel'
import { ShareLink } from './ShareLink'

/**
 * Entries tab (#14), routed at /admin/entries/*:
 * - /admin/entries            the current Raffle (Add / Remove / Restore while Open or Closed)
 * - /admin/entries/:raffleId  any Raffle, read-mostly (search, export, dismiss flags); linked from History
 */
export function EntriesTab() {
  return (
    <Routes>
      <Route index element={<EntriesView />} />
      <Route path=":raffleId" element={<RaffleEntriesRoute />} />
    </Routes>
  )
}

function RaffleEntriesRoute() {
  const { raffleId } = useParams()
  return <EntriesView raffleId={raffleId} />
}

const FILTERS: { key: EntriesFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'removed', label: 'Removed' },
  { key: 'excluded', label: 'Excluded' },
]

const STATUS_TAG: Record<EntriesRaffle['status'], { label: string; tone: 'blue' | 'neutral' | 'gold' | 'red' }> = {
  open: { label: 'Open', tone: 'blue' },
  closed: { label: 'Closed', tone: 'neutral' },
  drawn: { label: 'Drawn', tone: 'gold' },
  cancelled: { label: 'Cancelled', tone: 'red' },
}

async function loadEntries(raffleId: string | undefined) {
  const raffle = raffleId ? await getEntriesRaffle(raffleId) : await currentEntriesRaffle()
  if (!raffle) return { raffle: null, rows: [] as EntryRow[] }
  const [entries, flags] = await Promise.all([listEntries(raffle.id), listEntryFlags(raffle.id)])
  return { raffle, rows: buildRows(entries, flags) }
}

function EntriesView({ raffleId }: { raffleId?: string }) {
  const readMostly = raffleId !== undefined
  const { data, error, loading, reload } = useAdminQuery(() => loadEntries(raffleId), [raffleId])

  if (!data) {
    return (
      <>
        <PageHeader title="Entries" />
        <Panel>{error ? <InlineError>{error.message}</InlineError> : loading && <Loading />}</Panel>
      </>
    )
  }
  if (!data.raffle) {
    return (
      <>
        <PageHeader title="Entries" />
        <Panel>
          {readMostly ? (
            <EmptyState title="Raffle not found">
              It may have been removed. <Link to="/admin/history">Back to History</Link>
            </EmptyState>
          ) : (
            <EmptyState title="No raffle yet">Start one from the Dashboard; its entries show up here.</EmptyState>
          )}
        </Panel>
      </>
    )
  }
  return <EntriesTable raffle={data.raffle} rows={data.rows} readMostly={readMostly} reload={reload} error={error} />
}

function EntriesTable({
  raffle,
  rows,
  readMostly,
  reload,
  error,
}: {
  raffle: EntriesRaffle
  rows: EntryRow[]
  readMostly: boolean
  reload: () => void
  error: ApiError | undefined
}) {
  const handleError = useApiErrorHandler()
  const [filter, setFilter] = useState<EntriesFilter>('all')
  const [query, setQuery] = useState('')
  const [removing, setRemoving] = useState<EntryRow | null>(null)
  const [dismissing, setDismissing] = useState<DismissTarget | null>(null)
  const [adding, setAdding] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)

  const editable = !readMostly && (raffle.status === 'open' || raffle.status === 'closed')
  const visible = useMemo(() => filterRows(rows, filter, query), [rows, filter, query])
  const counts = useMemo(() => filterCounts(rows), [rows])
  const flaggedCount = rows.filter((r) => r.flagged).length

  async function restore(row: EntryRow) {
    setRowError(null)
    try {
      await restoreEntry(row.entry.id)
      reload()
    } catch (e) {
      const err = handleError(e)
      if (err) setRowError(`Couldn't restore ${row.entry.full_name}: ${friendlyEntryError(err)}`)
    }
  }

  function exportCsv() {
    // BOM so Excel reads UTF-8 names (José) correctly.
    const blob = new Blob(['\uFEFF', toCsv(visible)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = csvFileName(raffle, filter)
    a.click()
    URL.revokeObjectURL(url)
  }

  const columns: Column<EntryRow>[] = [
    {
      key: 'name',
      header: 'Name',
      className: 'name',
      render: (r) => (
        <>
          {r.entry.full_name}
          {r.pills.map((p) => (
            <button
              key={p.rule}
              type="button"
              className={`flag flag--${p.state === 'active' ? 'red' : 'removed'} entries__pill`}
              title={p.title}
              onClick={() => setDismissing({ rule: p.rule, entryName: r.entry.full_name, entryId: r.entry.id, pairs: p.pairs })}
            >
              {p.label}
              {p.state === 'pair-removed' && ' (pair removed)'}
            </button>
          ))}
          {r.entry.added_by_admin && <span className="entries__marker">added by admin</span>}
          {filter === 'flagged' &&
            r.dismissed.map((d) => (
              <span key={`${d.rule}-${d.otherName}`} className="entries__dismissed" title={`Dismissed: ${d.label} with ${d.otherName}`}>
                {d.label} dismissed
              </span>
            ))}
        </>
      ),
    },
    { key: 'email', header: 'Email', className: 'entries__email', render: (r) => r.entry.email },
    { key: 'entered', header: 'Entered', className: 'num', render: (r) => formatDateTime(r.entry.created_at) },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span title={r.status.title}>
          <Tag tone={r.status.tone}>{r.status.label}</Tag>
        </span>
      ),
    },
  ]
  if (editable) {
    columns.push({
      key: 'actions',
      header: <span className="visually-hidden">Actions</span>,
      render: (r) =>
        r.removed ? (
          <Button variant="link" onClick={() => restore(r)} aria-label={`Restore ${r.entry.full_name}`}>
            Restore
          </Button>
        ) : (
          <Button variant="link-danger" onClick={() => setRemoving(r)} aria-label={`Remove ${r.entry.full_name}`}>
            Remove
          </Button>
        ),
    })
  }

  const statusTag = STATUS_TAG[raffle.status]
  const caption =
    raffle.status === 'drawn' && raffle.drawn_at
      ? `Status is the Draw Snapshot verdict from ${formatDateTime(raffle.drawn_at)}. Flags are live.`
      : raffle.status === 'cancelled'
        ? 'Cancelled before a Draw. Status shows the eligibility rules as they apply now.'
        : 'Status is a live preview: who would be eligible if the Draw ran now.'

  return (
    <>
      <PageHeader
        title="Entries"
        lead={
          <>
            {raffle.title} · {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
            {flaggedCount > 0 && <span className="entries__flagged-count"> · {flaggedCount} flagged</span>}
          </>
        }
        actions={
          <>
            <Tag tone={statusTag.tone}>{statusTag.label}</Tag>
            {readMostly && (
              <Link className="btn btn--outline" to={`/admin/history/${raffle.id}`}>
                Raffle details
              </Link>
            )}
          </>
        }
      />
      <Panel>
        {error && <InlineError>{error.message}</InlineError>}
        {rows.length === 0 ? (
          <EmptyState
            title={readMostly ? 'No entries' : 'No entries yet, share the link'}
            action={
              (!readMostly || editable) && (
                <div className="entries__empty-actions">
                  {!readMostly && <ShareLink />}
                  {editable && (
                    <Button variant="outline" onClick={() => setAdding(true)}>
                      Add entry
                    </Button>
                  )}
                </div>
              )
            }
          />
        ) : (
          <>
            <div className="entries__tools">
              <input
                type="search"
                className="field entries__search"
                placeholder="Search name or email"
                aria-label="Search name or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {editable && (
                <Button variant="outline" onClick={() => setAdding(true)}>
                  Add entry
                </Button>
              )}
              <Button variant="outline" onClick={exportCsv}>
                Export CSV
              </Button>
            </div>
            <div className="entries__chips" role="group" aria-label="Filter entries">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className="entries__chip"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label} <span className="num">{counts[f.key]}</span>
                </button>
              ))}
            </div>
            <p className="entries__caption">{caption}</p>
            {rowError && <InlineError>{rowError}</InlineError>}
            <div className="entries__table">
              <DataTable
                caption={`Entries for ${raffle.title}`}
                columns={columns}
                rows={visible}
                rowKey={(r) => r.entry.id}
                rowClassName={(r) =>
                  r.removed ? 'row--muted' : r.pills.some((p) => p.state === 'active') ? 'row--red' : undefined
                }
                empty={<p className="entries__none">No entries match.</p>}
              />
            </div>
          </>
        )}
      </Panel>

      <ConfirmDialog
        open={removing !== null}
        title="Remove entry"
        confirmLabel="Remove entry"
        tone="danger"
        requireReason
        onCancel={() => setRemoving(null)}
        onConfirm={async (reason) => {
          if (!removing) return
          try {
            await removeEntry(removing.entry.id, reason)
          } catch (e) {
            const err = handleError(e)
            if (err) throw new Error(friendlyEntryError(err), { cause: e })
            return
          }
          setRemoving(null)
          reload()
        }}
      >
        {removing && (
          <>
            Remove <b>{removing.entry.full_name}</b> ({removing.entry.email}) from this raffle? The entry stays on record
            and can be restored.
          </>
        )}
      </ConfirmDialog>

      <DismissFlagDialog
        raffleId={raffle.id}
        target={dismissing}
        onClose={() => setDismissing(null)}
        onDismissed={() => {
          setDismissing(null)
          reload()
        }}
      />

      {adding && (
        <AddEntryModal
          raffleId={raffle.id}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            reload()
          }}
        />
      )}
    </>
  )
}

function csvFileName(raffle: EntriesRaffle, filter: EntriesFilter): string {
  const slug = raffle.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'raffle'
  const d = new Date()
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `entries-${slug}${filter === 'all' ? '' : `-${filter}`}-${date}.csv`
}
