import { describe, expect, test } from 'bun:test'

import { eachDay, periodWindow, shiftDate } from './window'

describe('periodWindow', () => {
  test('a week is the last seven days, today included', () => {
    expect(periodWindow('week', '2026-09-22')).toEqual({
      from: '2026-09-16',
      to: '2026-09-22',
      days: 7,
    })
  })

  test('a month and a year are rolling windows, not calendar boundaries', () => {
    expect(periodWindow('month', '2026-09-22').from).toBe('2026-08-24')
    expect(periodWindow('year', '2026-09-22').days).toBe(365)
  })
})

describe('eachDay', () => {
  test('gives a point for every day, so an empty day still shows up', () => {
    expect(eachDay('2026-09-20', 3)).toEqual(['2026-09-20', '2026-09-21', '2026-09-22'])
  })
})

describe('shiftDate', () => {
  test('crosses months and years without a time zone', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
  })
})
