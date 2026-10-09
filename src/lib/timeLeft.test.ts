import { formatTimeLeft } from './timeLeft'

const SEC = 1000
const MIN = 60 * SEC
const HR = 60 * MIN
const DAY = 24 * HR

describe('formatTimeLeft', () => {
  it.each([
    [2 * DAY + 14 * HR + 5 * MIN, '2 days 14 hrs'],
    [1 * DAY + 1 * HR, '1 day 1 hr'],
    [1 * DAY + 30 * MIN, '1 day 0 hrs'],
    [3 * HR + 5 * MIN + 59 * SEC, '3 hrs 5 min'],
    [1 * HR, '1 hr 0 min'],
    [4 * MIN + 9 * SEC, '4 min 9 sec'],
    [59 * SEC + 400, '59 sec'],
    [400, '0 sec'],
    [0, '0 sec'],
    [-5 * SEC, '0 sec'],
  ])('%i ms reads "%s"', (ms, text) => {
    expect(formatTimeLeft(ms)).toBe(text)
  })
})
