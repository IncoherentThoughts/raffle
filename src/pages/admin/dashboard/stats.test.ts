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

const raffle = { created_at: '2026-10-01T09:00:00', close_time: '2026-10-04T17:00:00' }

describe('raffleStats', () => {
  it('counts the six tiles per the #6 definitions', () => {
    const s = raffleStats(raffle, [
      entry(),
      entry({ is_returning: true }),
      entry({ eligible: false, is_returning: true }), // excluded by Window/Override
      entry({ flags: ['same_name'] }),
      entry({ removed_at: '2026-10-03T10:00:00', eligible: false, flags: ['same_name'] }), // removed
    ])
    expect(s).toMatchObject({ entries: 4, eligible: 3, excluded: 1, flags: 2, new: 2, returning: 2 })
  })

  it('buckets non-removed entries per local day from Opened to Close Time, empty days included', () => {
    const s = raffleStats(raffle, [
      entry({ created_at: '2026-10-01T10:00:00' }),
      entry({ created_at: '2026-10-01T23:30:00' }),
      entry({ created_at: '2026-10-03T08:00:00' }),
      entry({ created_at: '2026-10-03T09:00:00', removed_at: '2026-10-03T10:00:00', eligible: false }),
    ])
    expect(s.daily.map((d) => [d.day, d.count])).toEqual([
      ['2026-10-01', 2],
      ['2026-10-02', 0],
      ['2026-10-03', 1],
      ['2026-10-04', 0],
    ])
  })

  it('has a single day when the raffle opens and closes the same day', () => {
    const s = raffleStats({ created_at: '2026-10-01T09:00:00', close_time: '2026-10-01T09:30:00' }, [])
    expect(s.daily).toEqual([{ day: '2026-10-01', count: 0 }])
  })
})
