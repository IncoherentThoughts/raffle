import { describe, expect, it, vi } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
vi.mock('../supabase', () => import('../../test/fakeSupabase'))
import { csvCell, fetchAll, toCsv, zipFiles, exportFileName } from './export'

describe('csvCell', () => {
  it('leaves plain values alone and blanks nulls', () => {
    expect(csvCell('Jim Lee')).toBe('Jim Lee')
    expect(csvCell(42)).toBe('42')
    expect(csvCell(false)).toBe('false')
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })

  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('Lee, Jim')).toBe('"Lee, Jim"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('a\nb')).toBe('"a\nb"')
    expect(csvCell('a\r\nb')).toBe('"a\r\nb"')
  })

  it('neutralises formula injection in strings only', () => {
    for (const bad of ['=SUM(A1)', '+1', '-2', '@cmd', '\tx']) {
      expect(csvCell(bad)).toBe(`'${bad}`)
    }
    expect(csvCell('=1,2')).toBe('"\'=1,2"')
    expect(csvCell(-5)).toBe('-5')
  })

  it('serialises arrays and objects as JSON', () => {
    expect(csvCell(['a', 'b'])).toBe('"[""a"",""b""]"')
    expect(csvCell({ k: 1 })).toBe('"{""k"":1}"')
  })
})

describe('toCsv', () => {
  it('writes a header and CRLF rows, filling missing columns', () => {
    expect(toCsv(['a', 'b'], [{ a: 1, b: 'x,y' }, { a: 2 }])).toBe('a,b\r\n1,"x,y"\r\n2,\r\n')
  })
  it('writes just a header for no rows', () => {
    expect(toCsv(['a'], [])).toBe('a\r\n')
  })
})

describe('fetchAll', () => {
  const makePager = (total: number) =>
    vi.fn(async (from: number, to: number) =>
      Array.from({ length: Math.max(0, Math.min(to + 1, total) - from) }, (_, i) => from + i),
    )

  it('pages until a short page', async () => {
    const pager = makePager(2500)
    const all = await fetchAll(pager, 1000)
    expect(all).toHaveLength(2500)
    expect(all[2499]).toBe(2499)
    expect(pager.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('asks once more when the total is an exact multiple of the page size', async () => {
    const pager = makePager(2000)
    expect(await fetchAll(pager, 1000)).toHaveLength(2000)
    expect(pager).toHaveBeenCalledTimes(3)
  })

  it('handles an empty table', async () => {
    const pager = makePager(0)
    expect(await fetchAll(pager, 1000)).toEqual([])
    expect(pager).toHaveBeenCalledTimes(1)
  })

  it('propagates errors', async () => {
    await expect(fetchAll(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
  })
})

describe('zip', () => {
  it('contains each file', () => {
    const zip = unzipSync(zipFiles({ 'a.csv': 'x\r\n', 'b.csv': 'y\r\n' }))
    expect(Object.keys(zip).sort()).toEqual(['a.csv', 'b.csv'])
    expect([...zip['a.csv'].slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(strFromU8(zip['b.csv'])).toContain('y\r\n')
  })
  it('names the file by date', () => {
    expect(exportFileName(new Date('2026-10-08T12:00:00Z'))).toBe('raffle-export-2026-10-08.zip')
  })
})
