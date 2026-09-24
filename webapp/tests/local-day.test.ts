import { expect, test } from 'bun:test'

import {
  effectiveTimeZone,
  FALLBACK_TIME_ZONE,
  planDate,
  wallClock,
} from '../src/features/settings/local-day'

test('the plan date follows the zone and the day start, like the server rule', () => {
  // 23:30 UTC on 23 September is 02:30 on 24 September in Moscow.
  const moment = new Date('2026-09-23T23:30:00.000Z')
  expect(planDate(moment, { timeZone: 'Europe/Moscow', dayStartMinute: 0 })).toBe('2026-09-24')
  expect(planDate(moment, { timeZone: 'Europe/Moscow', dayStartMinute: 240 })).toBe('2026-09-23')
  expect(planDate(moment, { timeZone: 'America/New_York', dayStartMinute: 0 })).toBe('2026-09-23')
})

test('the wall clock handles half-hour zones and missing zones', () => {
  expect(wallClock(new Date('2026-09-23T20:00:00.000Z'), 'Asia/Kolkata')).toEqual({
    date: '2026-09-24',
    minuteOfDay: 90,
  })
  expect(effectiveTimeZone(null)).toBe(FALLBACK_TIME_ZONE)
  expect(effectiveTimeZone('Mars/Olympus')).toBe(FALLBACK_TIME_ZONE)
})
