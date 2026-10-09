import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { unzipSync, strFromU8 } from 'fflate'

vi.mock('../../../lib/supabase', () => import('../../../test/fakeSupabase'))
import { fake } from '../../../test/fakeSupabase'
import { renderAdmin } from '../test/renderAdmin'

beforeEach(() => {
  fake.reset()
})

function captureDownload() {
  const downloads: string[] = []
  let blob: Blob | undefined
  URL.createObjectURL = vi.fn((b: Blob) => ((blob = b), 'blob:x'))
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download)
  })
  return { downloads, blob: () => blob }
}

describe('Settings: Export all data', () => {
  it('downloads a zip with one CSV per table, including device_id', async () => {
    fake.onTable('entries', () =>
      fake.ok([{ id: 'e1', full_name: '=evil()', email: 'a@b.co', device_id: 'dev-1' }]),
    )
    const dl = captureDownload()
    renderAdmin('/admin/settings')
    await userEvent.click(await screen.findByRole('button', { name: 'Export all data' }))

    expect(await screen.findByText(/Downloaded raffle-export-\d{4}-\d{2}-\d{2}\.zip/)).toBeVisible()
    expect(dl.downloads[0]).toMatch(/^raffle-export-\d{4}-\d{2}-\d{2}\.zip$/)
    const zip = unzipSync(new Uint8Array(await dl.blob()!.arrayBuffer()))
    expect(Object.keys(zip).sort()).toEqual(
      [
        'activity_log',
        'draw_snapshot_entries',
        'draw_snapshots',
        'eligibility_overrides',
        'entries',
        'flag_dismissals',
        'raffles',
        'winners',
      ].map((t) => `${t}.csv`),
    )
    const entries = strFromU8(zip['entries.csv'])
    expect(entries).toContain('id,full_name,email,device_id')
    expect(entries).toContain("e1,'=evil(),a@b.co,dev-1")
  })

  it('shows an error and re-enables the button when a read fails', async () => {
    fake.onTable('winners', () => fake.dbError('boom', '55000'))
    captureDownload()
    renderAdmin('/admin/settings')
    await userEvent.click(await screen.findByRole('button', { name: 'Export all data' }))
    expect(await screen.findByText('Export failed: boom')).toBeVisible()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Export all data' })).toBeEnabled(),
    )
  })
})
