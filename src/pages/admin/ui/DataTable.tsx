import type { ReactNode } from 'react'

export type Column<T> = {
  /** Unique key for the column. */
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  /** Extra class on the <td>: 'num' for tabular numbers/dates, 'name' for bold names. */
  className?: string
}

type DataTableProps<T> = {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  /** e.g. row => row.flagged ? 'row--red' : row.removed ? 'row--muted' : undefined */
  rowClassName?: (row: T) => string | undefined
  /** Accessible name for the table (visually hidden). */
  caption: string
  /** Shown instead of the table when `rows` is empty. */
  empty?: ReactNode
}

/**
 * Letterhead table: blue-wash header row, hairline rows. Scrolls horizontally inside its
 * own container on narrow screens. Row classes: row--red, row--gold (flag wash + left bar),
 * row--muted (removed / replaced).
 */
export function DataTable<T>({ columns, rows, rowKey, rowClassName, caption, empty }: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>
  return (
    <div className="table-scroll">
      <table className="table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={rowClassName?.(row)}>
              {columns.map((c) => (
                <td key={c.key} className={c.className}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
