import { buildRows, filterRows, statusLabel, toCsv } from './entriesModel'
import { entry, pair } from './testFixtures'

describe('flag pills', () => {
  it('shows one red pill per rule naming the other Entries on hover', () => {
    const jim = entry({ id: 'jim', full_name: 'Jim Lee', flags: ['same_device'] })
    const james = entry({ id: 'james', full_name: 'James Lee', flags: ['same_device'] })
    const jay = entry({ id: 'jay', full_name: 'Jay Lee', flags: ['same_device'] })
    const rows = buildRows([jim, james, jay], [...pair('same_device', jim, james), ...pair('same_device', jim, jay)])
    expect(rows[0].pills).toEqual([
      { rule: 'same_device', label: 'same device', state: 'active', title: 'Same device as James Lee, Jay Lee',
        pairs: [{ otherId: 'james', otherName: 'James Lee', otherRemoved: false }, { otherId: 'jay', otherName: 'Jay Lee', otherRemoved: false }] },
    ])
    expect(rows[0].flagged).toBe(true)
  })

  it('turns the survivor\'s pill grey ("pair removed") when every other Entry is removed', () => {
    const rae = entry({ id: 'rae', full_name: 'Rae', removed_at: '2026-10-08T15:00:00Z', removed_reason: 'dup', eligible: false, reason: 'removed' })
    const ray = entry({ id: 'ray', full_name: 'Ray', flags: ['same_device'] })
    const [, rayRow] = buildRows([rae, ray], pair('same_device', rae, ray))
    expect(rayRow.pills[0]).toMatchObject({ state: 'pair-removed', label: 'same device', title: 'Same device as Rae (pair removed)' })
  })

  it('hides dismissed pairs as pills but keeps a dismissed marker', () => {
    const kim = entry({ id: 'kim', full_name: 'Kim Lee' })
    const kimberly = entry({ id: 'kimberly', full_name: 'Kimberly Lee' })
    const [kimRow] = buildRows([kim, kimberly], pair('email_match', kim, kimberly, { dismissed: true }))
    expect(kimRow.pills).toEqual([])
    expect(kimRow.dismissed).toEqual([{ rule: 'email_match', label: 'email match', otherName: 'Kimberly Lee' }])
    expect(kimRow.flagged).toBe(false)
    expect(kimRow.everFlagged).toBe(true)
  })

  it('orders pills same name, email match, same device', () => {
    const a = entry({ id: 'a', full_name: 'Ana' })
    const b = entry({ id: 'b', full_name: 'ana' })
    const [row] = buildRows([a, b], [...pair('same_device', a, b), ...pair('same_name', a, b), ...pair('email_match', a, b)])
    expect(row.pills.map((p) => p.rule)).toEqual(['same_name', 'email_match', 'same_device'])
  })
})

describe('status', () => {
  it.each([
    [entry({ id: 'a', full_name: 'A' }), 'Eligible', 'green'],
    [entry({ id: 'a', full_name: 'A', eligible: false, reason: 'exclusion_window', excluding_won_at: '2026-08-19T17:00:00Z' }), 'Excluded: won Aug 19, 2026', 'gold'],
    [entry({ id: 'a', full_name: 'A', reason: 'override_eligible', override_reason: 'manager ok' }), 'Override: always eligible', 'green'],
    [entry({ id: 'a', full_name: 'A', eligible: false, reason: 'override_excluded', override_reason: 'staff' }), 'Override: always excluded', 'gold'],
    [entry({ id: 'a', full_name: 'A', eligible: false, reason: 'removed', removed_at: '2026-10-08T15:00:00Z', removed_reason: 'dup' }), 'Removed', 'red'],
  ] as const)('%#: labels the verdict', (e, label, tone) => {
    expect(statusLabel(e)).toMatchObject({ label, tone })
  })
})

describe('filters and search', () => {
  const ana = entry({ id: 'ana', full_name: 'Ana Díaz', email: 'adiaz@thecomfortgroup.com', flags: ['same_name'] })
  const ana2 = entry({ id: 'ana2', full_name: 'ana diaz', email: 'ana@gmail.com', flags: ['same_name'] })
  const tom = entry({ id: 'tom', full_name: 'Tom Baxter', email: 'tbaxter@tcgmech.com', eligible: false, reason: 'exclusion_window', excluding_won_at: '2026-05-03T12:00:00Z' })
  const rae = entry({ id: 'rae', full_name: 'Rae', eligible: false, reason: 'removed', removed_at: '2026-10-08T15:00:00Z', removed_reason: 'dup' })
  const kim = entry({ id: 'kim', full_name: 'Kim' })
  const kim2 = entry({ id: 'kim2', full_name: 'Kim Two' })
  const rows = buildRows([ana, ana2, tom, rae, kim, kim2], [...pair('same_name', ana, ana2), ...pair('email_match', kim, kim2, { dismissed: true })])
  const ids = (f: Parameters<typeof filterRows>[1], q = '') => filterRows(rows, f, q).map((r) => r.entry.id)

  it('All shows every Entry, removed included', () => {
    expect(ids('all')).toEqual(['ana', 'ana2', 'tom', 'rae', 'kim', 'kim2'])
  })
  it('Flagged shows Entries with a flag, dismissed ones included (with their marker)', () => {
    expect(ids('flagged')).toEqual(['ana', 'ana2', 'kim', 'kim2'])
  })
  it('Removed shows removed Entries', () => {
    expect(ids('removed')).toEqual(['rae'])
  })
  it('Excluded shows non-removed Entries that are not eligible', () => {
    expect(ids('excluded')).toEqual(['tom'])
  })
  it('search matches name or email, ignoring case and accents', () => {
    expect(ids('all', 'DIAZ')).toEqual(['ana', 'ana2'])
    expect(ids('all', 'tcgmech')).toEqual(['tom'])
    expect(ids('flagged', 'gmail')).toEqual(['ana2'])
  })
})

describe('CSV export', () => {
  it('writes the filtered rows with the spec columns, flags semicolon-separated', () => {
    const a = entry({ id: 'a', full_name: 'Lee, "Jim"', email: 'jim@x.com', device_id: 'dev-1', flags: ['same_name', 'same_device'] })
    const b = entry({ id: 'b', full_name: 'Rae', email: 'rae@x.com', eligible: false, reason: 'removed',
      removed_at: '2026-10-08T15:00:00Z', removed_reason: 'typo\nresubmitted', created_at: '2026-10-07T09:30:00Z' })
    const csv = toCsv(buildRows([a, b], []))
    expect(csv.split('\r\n')).toEqual([
      'name,email,entered_at,status,flags,removed_at,removed_reason,device_id',
      '"Lee, ""Jim""",jim@x.com,2026-10-08T14:00:00Z,Eligible,same_name;same_device,,,dev-1',
      'Rae,rae@x.com,2026-10-07T09:30:00Z,Removed,,2026-10-08T15:00:00Z,"typo\nresubmitted",',
      '',
    ])
  })

  it('neutralises spreadsheet formulas in text cells', () => {
    const a = entry({ id: 'a', full_name: '=HYPERLINK("x")', email: 'a@x.com' })
    expect(toCsv(buildRows([a], [])).split('\r\n')[1]).toMatch(/^"'=HYPERLINK\(""x""\)",/)
  })
})
