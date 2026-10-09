import { DEVICE_ID_KEY, getDeviceId } from './deviceId'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function cookieValue(): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${DEVICE_ID_KEY}=`))
    ?.split('=')[1]
}

function clearCookie() {
  document.cookie = `${DEVICE_ID_KEY}=; max-age=0; path=/`
}

describe('getDeviceId', () => {
  beforeEach(() => {
    localStorage.clear()
    clearCookie()
  })

  it('creates a random UUID and stores it in both localStorage and a cookie', () => {
    const id = getDeviceId()
    expect(id).toMatch(UUID)
    expect(localStorage.getItem(DEVICE_ID_KEY)).toBe(id)
    expect(cookieValue()).toBe(id)
  })

  it('returns the same ID on later calls', () => {
    expect(getDeviceId()).toBe(getDeviceId())
  })

  it('restores the cookie from localStorage', () => {
    const id = '0b0e7c1a-6b3c-4b8e-9f5e-2d1c0a9b8c7d'
    localStorage.setItem(DEVICE_ID_KEY, id)
    expect(getDeviceId()).toBe(id)
    expect(cookieValue()).toBe(id)
  })

  it('restores localStorage from the cookie', () => {
    const id = '7f3d2c1b-0a9e-4d8c-8b7a-6e5f4d3c2b1a'
    document.cookie = `${DEVICE_ID_KEY}=${id}; path=/`
    expect(getDeviceId()).toBe(id)
    expect(localStorage.getItem(DEVICE_ID_KEY)).toBe(id)
  })

  it('ignores a malformed stored value', () => {
    localStorage.setItem(DEVICE_ID_KEY, 'not-a-uuid<script>')
    const id = getDeviceId()
    expect(id).toMatch(UUID)
    expect(id).not.toBe('not-a-uuid<script>')
  })

  it('still returns an ID when storage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(getDeviceId()).toMatch(UUID)
    spy.mockRestore()
    set.mockRestore()
  })
})
