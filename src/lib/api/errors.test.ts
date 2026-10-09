import { ApiError, unwrap } from './errors'

function fail(status: number, error: { message: string; code: string; details?: string; hint?: string }) {
  return { data: null, status, error: { details: '', hint: '', ...error } }
}

function caught(fn: () => unknown): ApiError {
  try {
    fn()
  } catch (e) {
    if (e instanceof ApiError) return e
    throw e
  }
  throw new Error('expected unwrap to throw')
}

describe('unwrap', () => {
  it('returns data from a successful response', () => {
    expect(unwrap({ data: [1, 2], error: null, status: 200 })).toEqual([1, 2])
  })

  it('treats a network failure (status 0) as unreachable', () => {
    const e = caught(() => unwrap(fail(0, { message: 'TypeError: Failed to fetch', code: '' })))
    expect(e.kind).toBe('unreachable')
  })

  it('treats a gateway error with no database code as unreachable (paused project)', () => {
    expect(caught(() => unwrap(fail(503, { message: 'Service Unavailable', code: '' }))).kind).toBe('unreachable')
    expect(caught(() => unwrap(fail(503, { message: 'schema cache', code: 'PGRST002' }))).kind).toBe('unreachable')
  })

  it('treats not_admin (42501) as unauthorized', () => {
    const e = caught(() => unwrap(fail(403, { message: 'not_admin', code: '42501' })))
    expect(e.kind).toBe('unauthorized')
  })

  it('treats an expired or invalid JWT as unauthorized', () => {
    expect(caught(() => unwrap(fail(401, { message: 'JWT expired', code: 'PGRST301' }))).kind).toBe('unauthorized')
  })

  it('keeps business errors raised by the database as app errors with their message', () => {
    const e = caught(() =>
      unwrap(fail(500, { message: 'raffle_not_open', code: '55000', hint: 'Only open raffles' })),
    )
    expect(e.kind).toBe('app')
    expect(e.message).toBe('raffle_not_open')
    expect(e.code).toBe('55000')
    expect(e.hint).toBe('Only open raffles')
  })
})
