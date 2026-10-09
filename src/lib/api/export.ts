import { zipSync, strToU8 } from 'fflate'
import { supabase } from '../supabase'
import { unwrap } from './errors'
import type { Tables } from './rpc'

/** PostgREST caps a response at 1000 rows by default, so read in pages of that size. */
export const PAGE_SIZE = 1000

type CsvRow = Record<string, unknown>

/**
 * One CSV cell. Strings starting with = + - @ (or a tab/CR) get a leading single quote so a
 * spreadsheet never evaluates them as a formula; fields with commas, quotes or newlines are
 * quoted with internal quotes doubled. null/undefined are empty, objects and arrays JSON.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Header line plus one line per row (CRLF, per RFC 4180). Columns missing from a row are empty. */
export function toCsv(columns: string[], rows: CsvRow[]): string {
  const lines = [columns.map(csvCell).join(',')]
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(','))
  return lines.join('\r\n') + '\r\n'
}

/** Read every row by calling `fetchPage(from, to)` (inclusive range) until a short page returns. */
export async function fetchAll<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1)
    all.push(...page)
    if (page.length < pageSize) return all
  }
}

type ExportTable = Extract<
  keyof Tables,
  | 'raffles'
  | 'entries'
  | 'winners'
  | 'draw_snapshots'
  | 'draw_snapshot_entries'
  | 'eligibility_overrides'
  | 'flag_dismissals'
  | 'activity_log'
>

/** Stable sort keys so paging never skips or repeats a row. */
const EXPORT_TABLES: { table: ExportTable; order: string[] }[] = [
  { table: 'raffles', order: ['id'] },
  { table: 'entries', order: ['id'] },
  { table: 'winners', order: ['id'] },
  { table: 'draw_snapshots', order: ['raffle_id'] },
  { table: 'draw_snapshot_entries', order: ['raffle_id', 'entry_id'] },
  { table: 'eligibility_overrides', order: ['id'] },
  { table: 'flag_dismissals', order: ['id'] },
  { table: 'activity_log', order: ['id'] },
]

async function readTable(table: ExportTable, order: string[]): Promise<CsvRow[]> {
  return fetchAll(async (from, to) => {
    let query = supabase.from(table).select('*')
    for (const column of order) query = query.order(column)
    return (unwrap(await query.range(from, to)) ?? []) as unknown as CsvRow[]
  })
}

/** CSV text per table (`<table>.csv`), every column included (device_id too). */
export async function buildExportFiles(
  onProgress?: (table: string) => void,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  for (const { table, order } of EXPORT_TABLES) {
    onProgress?.(table)
    const rows = await readTable(table, order)
    // select * returns every column in table order; an empty table has no rows to take them from.
    files[`${table}.csv`] = toCsv(rows.length ? Object.keys(rows[0]) : [], rows)
  }
  return files
}

export const exportFileName = (now = new Date()) =>
  `raffle-export-${now.toISOString().slice(0, 10)}.zip`

/** Zip the CSV files (UTF-8 with a BOM so Excel reads names correctly). */
export function zipFiles(files: Record<string, string>): Uint8Array<ArrayBuffer> {
  const entries: Record<string, Uint8Array> = {}
  for (const [name, text] of Object.entries(files)) entries[name] = strToU8('﻿' + text)
  return zipSync(entries) as Uint8Array<ArrayBuffer>
}

/** Build the export and hand it to the browser as a download. Returns the file name. */
export async function exportAllData(onProgress?: (table: string) => void): Promise<string> {
  const files = await buildExportFiles(onProgress)
  const name = exportFileName()
  const url = URL.createObjectURL(new Blob([zipFiles(files)], { type: 'application/zip' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return name
}
