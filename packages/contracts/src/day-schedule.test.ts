import { describe, expect, test } from 'bun:test'

import {
  compareTasksInDay,
  minutesFromDayStart,
  overlappingTaskIds,
  ruleDates,
  ruleMatches,
} from './day-schedule'

const task = (id: string, startMinute: number | null, durationMinutes = 30, position = 0) => ({
  id,
  startMinute,
  durationMinutes,
  position,
})

describe('a day that starts at its own hour', () => {
  test('counts minutes from the day start, wrapping past midnight', () => {
    expect(minutesFromDayStart(4 * 60, 4 * 60)).toBe(0)
    expect(minutesFromDayStart(60, 4 * 60)).toBe(21 * 60)
    expect(minutesFromDayStart(8 * 60, 0)).toBe(8 * 60)
  })

  test('puts 01:00 last when the day starts at 04:00', () => {
    const ordered = [task('night', 60), task('morning', 7 * 60), task('free', null)].sort(
      compareTasksInDay(4 * 60),
    )
    expect(ordered.map((each) => each.id)).toEqual(['morning', 'night', 'free'])
  })

  test('sees an overlap across midnight', () => {
    const tasks = [task('late', 23 * 60 + 30, 120), task('night', 60), task('morning', 8 * 60)]
    expect([...overlappingTaskIds(tasks, 4 * 60)].sort()).toEqual(['late', 'night'])
    expect(overlappingTaskIds([task('a', 10 * 60, 30), task('b', 10 * 60 + 30)]).size).toBe(0)
    expect(overlappingTaskIds([task('a', null), task('b', null)]).size).toBe(0)
  })
})

describe('schedule rules', () => {
  test('weekdays count from Sunday', () => {
    // 2026-09-21 is a Monday.
    const mondayWednesdayFriday = { kind: 'weekdays' as const, weekdays: [1, 3, 5] }
    expect(ruleDates(mondayWednesdayFriday, '2026-09-21', '2026-09-27')).toEqual([
      '2026-09-21',
      '2026-09-23',
      '2026-09-25',
    ])
  })

  test('the 31st falls on the last day of a shorter month', () => {
    const rule = { kind: 'monthdays' as const, monthDays: [31] }
    expect(ruleMatches(rule, '2026-02-28')).toBe(true)
    expect(ruleMatches(rule, '2026-03-30')).toBe(false)
    expect(ruleMatches(rule, '2026-03-31')).toBe(true)
  })

  test('chosen dates are exactly those dates', () => {
    const rule = { kind: 'dates' as const, dates: ['2026-10-01', '2026-10-05'] }
    expect(ruleDates(rule, '2026-09-30', '2026-10-10')).toEqual(['2026-10-01', '2026-10-05'])
    expect(ruleDates({ kind: 'daily' }, '2026-10-01', '2026-10-03')).toHaveLength(3)
  })
})
