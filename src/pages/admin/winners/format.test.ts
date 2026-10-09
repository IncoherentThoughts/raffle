import type { WinnerRow } from '../../../lib/api/winners'
import { localDateToIso, overrideTitle, todayInputValue, winnerStatus } from './format'

const base: WinnerRow = {
  id: 'w1',
  source: 'draw',
  raffle_id: 'r1',
  raffle_title: 'Titans Home Opener',
  position: 1,
  full_name: 'Dakota Worthen',
  email: 'dworthen@example.com',
  email_normalized: 'dworthen@example.com',
  won_at: '2026-08-19T17:00:00Z',
  status: 'standing',
  replaced_at: null,
  replaced_reason: null,
  note: null,
  window_enabled: true,
  window_months: 12,
  excluded: true,
  excluded_until: '2027-08-19T17:00:00Z',
  override_id: null,
  override_kind: null,
  override_reason: null,
  override_expires_at: null,
}

describe('winnerStatus', () => {
  it('labels an excluded Standing Winner with the window length and the end date on hover', () => {
    expect(winnerStatus({ ...base, window_months: 6 })).toEqual({
      label: 'Excluded 6 mo',
      tone: 'gold',
      title: 'Excluded from draws until Aug 19, 2027',
    })
  })

  it('labels a Standing Winner outside the window "Eligible again"', () => {
    expect(winnerStatus({ ...base, excluded: false })).toMatchObject({ label: 'Eligible again', tone: 'green' })
  })

  it('labels a Replaced Winner "Replaced" with the reason on hover, whatever the window says', () => {
    expect(
      winnerStatus({ ...base, status: 'replaced', excluded: false, replaced_reason: 'could not attend' }),
    ).toEqual({ label: 'Replaced', tone: 'neutral', title: 'Replaced: could not attend' })
  })
})

describe('dates', () => {
  it('turns a date input value into the start of that local day', () => {
    const iso = localDateToIso('2025-10-02')!
    const d = new Date(iso)
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2025, 9, 2, 0])
    expect(localDateToIso('')).toBeNull()
    expect(localDateToIso('10/02/2025')).toBeNull()
  })

  it('formats today for a date input', () => {
    expect(todayInputValue(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('builds the override hover text from reason and expiry', () => {
    expect(overrideTitle('vendor staff', '2026-12-01T12:00:00Z')).toBe('vendor staff · Expires Dec 1, 2026')
    expect(overrideTitle('vendor staff', null)).toBe('vendor staff')
  })
})
