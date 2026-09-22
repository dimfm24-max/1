import { describe, expect, test } from 'bun:test'

import { currentStreak, isDueOn, longestStreak, type HabitPlan } from './streak'

function plan(overrides: Partial<HabitPlan> = {}): HabitPlan {
  return {
    schedule: 'daily',
    weekdays: [],
    intervalDays: 1,
    startedOn: '2026-09-01',
    ...overrides,
  }
}

describe('isDueOn', () => {
  test('a daily habit is due every day from the day it started', () => {
    expect(isDueOn(plan(), '2026-09-01')).toBe(true)
    expect(isDueOn(plan(), '2026-09-15')).toBe(true)
    expect(isDueOn(plan(), '2026-08-31')).toBe(false)
  })

  test('a weekday habit is due only on the days it names', () => {
    // 2026-09-01 is a Tuesday.
    const tuesdaysAndThursdays = plan({ schedule: 'weekdays', weekdays: [2, 4] })
    expect(isDueOn(tuesdaysAndThursdays, '2026-09-01')).toBe(true)
    expect(isDueOn(tuesdaysAndThursdays, '2026-09-02')).toBe(false)
    expect(isDueOn(tuesdaysAndThursdays, '2026-09-03')).toBe(true)
  })

  test('an interval counts from the start date, so the anchor never drifts', () => {
    const everyThirdDay = plan({ schedule: 'interval', intervalDays: 3 })
    expect(isDueOn(everyThirdDay, '2026-09-01')).toBe(true)
    expect(isDueOn(everyThirdDay, '2026-09-02')).toBe(false)
    expect(isDueOn(everyThirdDay, '2026-09-03')).toBe(false)
    expect(isDueOn(everyThirdDay, '2026-09-04')).toBe(true)
  })
})

describe('currentStreak', () => {
  test('counts the run of kept days', () => {
    const marks = new Set(['2026-09-03', '2026-09-04', '2026-09-05'])
    expect(currentStreak(plan(), marks, '2026-09-05')).toBe(3)
  })

  test('a missed due day breaks it', () => {
    const marks = new Set(['2026-09-03', '2026-09-05'])
    expect(currentStreak(plan(), marks, '2026-09-05')).toBe(1)
  })

  test('today is not held against the person while the day is still running', () => {
    const marks = new Set(['2026-09-03', '2026-09-04'])
    expect(currentStreak(plan(), marks, '2026-09-05')).toBe(2)
  })

  test('days the habit was never due do not break it', () => {
    const everyThirdDay = plan({ schedule: 'interval', intervalDays: 3 })
    const marks = new Set(['2026-09-01', '2026-09-04', '2026-09-07'])
    expect(currentStreak(everyThirdDay, marks, '2026-09-07')).toBe(3)
  })

  test('a habit never kept has no streak', () => {
    expect(currentStreak(plan(), new Set(), '2026-09-05')).toBe(0)
  })
})

describe('longestStreak', () => {
  test('remembers the best run, not the current one', () => {
    const marks = new Set([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      // gap on the 4th
      '2026-09-05',
    ])
    expect(longestStreak(plan(), marks, '2026-09-05')).toBe(3)
    expect(currentStreak(plan(), marks, '2026-09-05')).toBe(1)
  })

  test('an unfinished today does not end the record', () => {
    const marks = new Set(['2026-09-01', '2026-09-02', '2026-09-03'])
    expect(longestStreak(plan(), marks, '2026-09-04')).toBe(3)
  })
})
