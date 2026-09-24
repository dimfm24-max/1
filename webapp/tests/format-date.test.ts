import { expect, test } from 'bun:test'

import {
  formatCount,
  formatDate,
  formatDuration,
  formatMinuteOfDay,
  formatNumber,
  parseMinuteOfDay,
  pluralForm,
} from '../src/platform/intl'

// Noon UTC: `bun test` runs in UTC unless the shell exports TZ, and even then every zone within
// eleven hours of UTC still lands on the same calendar day.
const createdAt = '2026-03-05T12:00:00.000Z'

test('formatDate renders a moment as DD.MM.YYYY', () => {
  expect(formatDate(createdAt)).toBe('05.03.2026')
  expect(formatDate(new Date(createdAt))).toBe('05.03.2026')
})

test('formatDate prints a calendar day as written, with no time zone shift', () => {
  expect(formatDate('2026-09-21')).toBe('21.09.2026')
  expect(formatDate('2026-01-01')).toBe('01.01.2026')
})

test('pluralForm agrees with Russian counts, including 11-14', () => {
  const days = ['день', 'дня', 'дней'] as const
  expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111].map((n) => pluralForm(n, days))).toEqual([
    'день',
    'дня',
    'дня',
    'дней',
    'дней',
    'дней',
    'дней',
    'день',
    'дня',
    'дней',
    'день',
    'дней',
  ])
  expect(formatCount(3, days)).toBe('3 дня')
})

test('formatNumber uses a decimal comma', () => {
  expect(formatNumber(3.3333)).toBe('3,333')
  expect(formatNumber(60)).toBe('60')
})

test('time of day is 24-hour both ways', () => {
  expect(formatMinuteOfDay(510)).toBe('08:30')
  expect(formatMinuteOfDay(1439)).toBe('23:59')
  expect(parseMinuteOfDay('8:30')).toBe(510)
  expect(parseMinuteOfDay('23:59')).toBe(1439)
  expect(parseMinuteOfDay('0830')).toBe(510)
  expect(parseMinuteOfDay('24:00')).toBeNull()
  expect(parseMinuteOfDay('8:60')).toBeNull()
  expect(parseMinuteOfDay('abc')).toBeNull()
})

test('formatDuration reads in hours and minutes', () => {
  expect(formatDuration(45)).toBe('45 мин')
  expect(formatDuration(60)).toBe('1 ч')
  expect(formatDuration(90)).toBe('1 ч 30 мин')
})
