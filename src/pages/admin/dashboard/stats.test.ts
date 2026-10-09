import { raffleStats, type StatsEntry } from './stats'

function entry(over: Partial<StatsEntry> = {}): StatsEntry {
  return {
    created_at: '2026-10-02T15:00:00',
    removed_at: null,
    eligible: true,
    flags: [],
    is_returning: false,
    ...over,
  }
}

describe('raffleStats', () => {
  it('counts the six tiles per the #6 definitions', () => {
    const s = raffleStats([
      entry(),
      entry({ is_returning: true }),
      entry({ eligible: false, is_returning: true }), // excluded by Window/Override
      entry({ flags: ['same_name'] }),
      entry({ removed_at: '2026-10-03T10:00:00', eligible: false, flags: ['same_name'] }), // removed
    ])
    expect(s).toMatchObject({ entries: 4, eligible: 3, excluded: 1, flags: 2, new: 2, returning: 2 })
  })
})
