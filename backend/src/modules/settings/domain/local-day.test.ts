import { describe, expect, test } from 'bun:test'

import {
  daysBetween,
  effectiveTimeZone,
  FALLBACK_TIME_ZONE,
  isKnownTimeZone,
  planDate,
  shiftDate,
  wallClock,
} from './local-day'

describe('time zones', () => {
  test('known names pass and unknown ones fail without throwing', () => {
    expect(isKnownTimeZone('Europe/Moscow')).toBe(true)
    expect(isKnownTimeZone('Asia/Kolkata')).toBe(true)
    expect(isKnownTimeZone('Mars/Olympus')).toBe(false)
    expect(isKnownTimeZone('')).toBe(false)
  })

  test('a missing or broken zone falls back instead of breaking the day', () => {
    expect(effectiveTimeZone(null)).toBe(FALLBACK_TIME_ZONE)
    expect(effectiveTimeZone('Mars/Olympus')).toBe(FALLBACK_TIME_ZONE)
    expect(effectiveTimeZone('Asia/Tokyo')).toBe('Asia/Tokyo')
  })
})

describe('wallClock', () => {
  test('reads the calendar and the clock of the zone', () => {
    const moment = new Date('2026-09-23T21:30:00.000Z')
    expect(wallClock(moment, 'Europe/Moscow')).toEqual({ date: '2026-09-24', minuteOfDay: 30 })
    expect(wallClock(moment, 'America/New_York')).toEqual({
      date: '2026-09-23',
      minuteOfDay: 17 * 60 + 30,
    })
  })

  test('handles a zone with a half-hour offset', () => {
    expect(wallClock(new Date('2026-09-23T20:00:00.000Z'), 'Asia/Kolkata')).toEqual({
      date: '2026-09-24',
      minuteOfDay: 90,
    })
  })

  test('follows daylight saving time', () => {
    // Berlin is UTC+1 in winter and UTC+2 in summer.
    expect(wallClock(new Date('2026-01-15T12:00:00.000Z'), 'Europe/Berlin').minuteOfDay).toBe(13 * 60)
    expect(wallClock(new Date('2026-07-15T12:00:00.000Z'), 'Europe/Berlin').minuteOfDay).toBe(14 * 60)
    // The night the clocks go forward: 01:30 UTC is already 03:30 in Berlin.
    expect(wallClock(new Date('2026-03-29T01:30:00.000Z'), 'Europe/Berlin').minuteOfDay).toBe(
      3 * 60 + 30,
    )
  })
})

describe('planDate', () => {
  const moscow = 'Europe/Moscow'

  test('with a midnight start the plan is the calendar day', () => {
    expect(planDate(new Date('2026-09-23T21:30:00.000Z'), { timeZone: moscow, dayStartMinute: 0 })).toBe(
      '2026-09-24',
    )
  })

  test('before a 04:00 start the previous plan is still open', () => {
    // 02:30 in Moscow on 24 September.
    const moment = new Date('2026-09-23T23:30:00.000Z')
    expect(planDate(moment, { timeZone: moscow, dayStartMinute: 240 })).toBe('2026-09-23')
    // 04:00 exactly opens the new plan.
    expect(planDate(new Date('2026-09-24T01:00:00.000Z'), { timeZone: moscow, dayStartMinute: 240 })).toBe(
      '2026-09-24',
    )
  })

  test('uses the fallback zone when none is saved', () => {
    expect(planDate(new Date('2026-09-23T21:30:00.000Z'), { timeZone: null, dayStartMinute: 0 })).toBe(
      '2026-09-24',
    )
  })
})

test('date arithmetic is on calendar days', () => {
  expect(shiftDate('2026-02-28', 1)).toBe('2026-03-01')
  expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31')
  expect(daysBetween('2026-09-23', '2026-09-26')).toBe(3)
  expect(daysBetween('2026-09-23', '2026-09-20')).toBe(-3)
})
