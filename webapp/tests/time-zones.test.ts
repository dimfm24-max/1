import { describe, expect, test } from 'bun:test'

import { matchesTimeZone, timeZoneOptions, zoneOffset } from '../src/features/settings/time-zones'

describe('time zone list', () => {
  const now = new Date('2026-01-15T12:00:00.000Z')

  test('offers the saved zone even when the browser cannot list zones', () => {
    const options = timeZoneOptions(['Europe/Moscow', null], now)
    expect(options.some((option) => option.zone === 'Europe/Moscow')).toBe(true)
  })

  test('shows the offset in UTC terms', () => {
    expect(zoneOffset('Europe/Moscow', now)).toBe('UTC+3')
    expect(zoneOffset('UTC', now)).toBe('UTC+0')
    expect(zoneOffset('America/St_Johns', now)).toBe('UTC−3:30')
  })

  test('finds a zone by Russian city, English name or offset', () => {
    const moscow = timeZoneOptions(['Europe/Moscow'], now).find(
      (option) => option.zone === 'Europe/Moscow',
    )!
    expect(matchesTimeZone(moscow, 'моск')).toBe(true)
    expect(matchesTimeZone(moscow, 'Moscow')).toBe(true)
    expect(matchesTimeZone(moscow, '+3')).toBe(true)
    expect(matchesTimeZone(moscow, 'Berlin')).toBe(false)
    expect(matchesTimeZone(moscow, '')).toBe(true)
  })
})
