import type { WinnerRow } from '../../../lib/api/history'
import { describeActivity, verdictLabel, winnerSlots } from './model'

const winner = (o: Partial<WinnerRow>): WinnerRow => ({
  id: 'w',
  source: 'draw',
  raffle_id: 'r1',
  position: 1,
  entry_id: 'e',
  replaces_winner_id: null,
  full_name: 'Someone',
  email: 'someone@x.test',
  email_normalized: 'someone@x.test',
  won_at: '2026-10-01T12:00:00Z',
  status: 'standing',
  replaced_at: null,
  replaced_reason: null,
  note: null,
  created_at: '2026-10-01T12:00:00Z',
  ...o,
})

describe('winnerSlots', () => {
  it('orders each slot\'s Redraw chain and finds the Standing Winner', () => {
    const slots = winnerSlots(2, [
      winner({ id: 'b', source: 'redraw', won_at: '2026-10-02T00:00:00Z', status: 'replaced', replaced_reason: 'r2' }),
      winner({ id: 'a', status: 'replaced', replaced_reason: 'r1' }),
      winner({ id: 'c', source: 'redraw', won_at: '2026-10-03T00:00:00Z' }),
      winner({ id: 'd', position: 2 }),
    ])
    expect(slots[0].chain.map((w) => w.id)).toEqual(['a', 'b', 'c'])
    expect(slots[0].standing?.id).toBe('c')
    expect(slots[0].vacancy).toBeNull()
    expect(slots[1].standing?.id).toBe('d')
  })

  it('tells a slot the Draw never filled from one a Redraw left vacant', () => {
    const slots = winnerSlots(3, [
      winner({ id: 'a', status: 'replaced', replaced_reason: 'cannot attend' }),
      winner({ id: 'b', position: 2 }),
    ])
    expect(slots.map((s) => s.vacancy)).toEqual(['no_alternates', null, 'unfilled'])
  })
})

describe('describeActivity', () => {
  it('describes a partial Draw with its vacant slots', () => {
    expect(
      describeActivity({
        action: 'draw',
        details: { winner_count: 3, eligible: 2, winners: [{ name: 'Avery Kim' }, { name: 'Diego Silva' }] },
      }),
    ).toBe('Drew 2 winners from 2 eligible entries: Avery Kim, Diego Silva; 1 slot left vacant')
  })

  it('describes a Redraw, with and without an alternate', () => {
    expect(
      describeActivity({ action: 'redraw', details: { position: 1, replaced_name: 'A', new_name: 'B', vacant: false } }),
    ).toBe('Redrew slot 1: replaced A with B')
    expect(describeActivity({ action: 'redraw', details: { position: 2, replaced_name: 'A', vacant: true } })).toBe(
      'Redrew slot 2: replaced A; no eligible alternates, slot left vacant',
    )
  })

  it('names what an edit changed and whether it reopened the Raffle', () => {
    expect(
      describeActivity({
        action: 'raffle_edit',
        details: {
          before: { title: 'T', close_time: '2026-10-01T00:00:00Z' },
          after: { title: 'T', close_time: '2026-10-09T00:00:00Z' },
          reopened: true,
          closed_early: false,
        },
      }),
    ).toBe('Reopened the raffle: changed Close Time')
  })

  it('has a sentence for every logged action', () => {
    const actions = [
      'raffle_create', 'raffle_close_early', 'raffle_cancel', 'entry_add', 'entry_remove', 'entry_restore',
      'past_winner_add', 'past_winner_delete', 'override_set', 'override_clear', 'flag_dismiss',
    ]
    for (const action of actions) {
      expect(describeActivity({ action, details: {} })).not.toContain('_')
    }
    expect(describeActivity({ action: 'override_set', details: { kind: 'force_eligible' } })).toBe(
      'Set an override: always eligible',
    )
    expect(describeActivity({ action: 'flag_dismiss', details: { rule: 'same_device' } })).toBe(
      'Dismissed a "same device" flag',
    )
  })
})

describe('verdictLabel', () => {
  it('explains each Snapshot verdict', () => {
    const base = {
      raffle_id: 'r', entry_id: 'e', full_name: 'n', email: 'e', email_normalized: 'e', eligible: false,
      excluding_winner_id: null, excluding_won_at: null, override_id: null, override_reason: null, flags: [],
    }
    expect(verdictLabel({ ...base, eligible: true, reason: 'eligible' })).toBe('Eligible')
    expect(verdictLabel({ ...base, reason: 'removed' })).toBe('Excluded: removed')
    expect(verdictLabel({ ...base, reason: 'override_excluded', override_reason: 'HR request' })).toBe(
      'Excluded (override: HR request)',
    )
    expect(verdictLabel({ ...base, reason: 'exclusion_window', excluding_won_at: '2026-03-15T12:00:00Z' })).toMatch(
      /^Excluded: won Mar 1[45], 2026$/,
    )
  })
})
