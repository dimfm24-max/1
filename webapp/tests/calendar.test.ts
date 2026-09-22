import { expect, test } from 'bun:test'

import {
  dayOfMonth,
  formatMonth,
  monthGrid,
  monthOf,
  shiftMonth,
  weekdayHeadings,
} from '../src/features/calendar/calendar'

test('the grid always holds six weeks, so the page never jumps between months', () => {
  expect(monthGrid('2026-09', '2026-09-22')).toHaveLength(42)
  expect(monthGrid('2026-02', '2026-09-22')).toHaveLength(42)
})

test('the grid starts on Monday, whatever weekday the month begins on', () => {
  // 2026-09-01 is a Tuesday, so the grid opens on Monday the 31st of August.
  const september = monthGrid('2026-09', '2026-09-22')
  expect(september[0]?.date).toBe('2026-08-31')
  expect(weekdayHeadings[0]).toBe('пн')

  // 2026-11-01 is a Sunday: the grid opens a full week earlier.
  expect(monthGrid('2026-11', '2026-09-22')[0]?.date).toBe('2026-10-26')
})

test('days outside the month are marked so they can be dimmed', () => {
  const grid = monthGrid('2026-09', '2026-09-22')

  expect(grid[0]?.isCurrentMonth).toBe(false)
  expect(grid.find((cell) => cell.date === '2026-09-01')?.isCurrentMonth).toBe(true)
  expect(grid.filter((cell) => cell.isCurrentMonth)).toHaveLength(30)
})

test('today is marked once, and only inside the grid that holds it', () => {
  expect(monthGrid('2026-09', '2026-09-22').filter((cell) => cell.isToday)).toHaveLength(1)
  expect(monthGrid('2027-03', '2026-09-22').filter((cell) => cell.isToday)).toHaveLength(0)
})

test('moving between months crosses years', () => {
  expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  expect(monthOf('2026-09-22')).toBe('2026-09')
  expect(dayOfMonth('2026-09-22')).toBe(22)
})

test('names the month the way a person reads it', () => {
  expect(formatMonth('2026-09')).toBe('сентябрь 2026')
  expect(formatMonth('2026-01')).toBe('январь 2026')
})
