import { expect, test } from 'bun:test'
import type { HabitDto } from '@dilife/contracts'

import { describeSchedule, formatStreak, habitStrip, isDueOn } from '../src/features/habits/habit-view'

function habit(overrides: Partial<HabitDto> = {}): HabitDto {
  return {
    id: 'habit-1',
    title: 'Зарядка',
    schedule: 'daily',
    weekdays: [],
    intervalDays: 1,
    startedOn: '2026-09-01',
    archivedAt: null,
    color: null,
    position: 0,
    marks: [],
    currentStreak: 0,
    longestStreak: 0,
    ...overrides,
  }
}

test('a daily habit is due from the day it started, never before', () => {
  expect(isDueOn(habit(), '2026-09-05')).toBe(true)
  expect(isDueOn(habit(), '2026-08-31')).toBe(false)
})

test('a weekday habit is due only on its days', () => {
  // 2026-09-01 is a Tuesday.
  const tuesdays = habit({ schedule: 'weekdays', weekdays: [2] })
  expect(isDueOn(tuesdays, '2026-09-01')).toBe(true)
  expect(isDueOn(tuesdays, '2026-09-02')).toBe(false)
})

test('an interval counts from the start date', () => {
  const everyThird = habit({ schedule: 'interval', intervalDays: 3 })
  expect(isDueOn(everyThird, '2026-09-04')).toBe(true)
  expect(isDueOn(everyThird, '2026-09-05')).toBe(false)
})

test('the strip ends on today and knows which squares were kept', () => {
  const strip = habitStrip(habit({ marks: ['2026-09-09', '2026-09-10'] }), '2026-09-10', 3)

  expect(strip.map((day) => day.date)).toEqual(['2026-09-08', '2026-09-09', '2026-09-10'])
  expect(strip.map((day) => day.isDone)).toEqual([false, true, true])
  expect(strip.at(-1)?.isToday).toBe(true)
})

test('the strip greys out days the habit was never due', () => {
  const strip = habitStrip(
    habit({ schedule: 'interval', intervalDays: 3 }),
    '2026-09-04',
    4,
  )

  expect(strip.map((day) => day.isDue)).toEqual([true, false, false, true])
})

test('says the streak the way a person would', () => {
  expect(formatStreak(0)).toBe('серия прервана')
  expect(formatStreak(1)).toBe('1 день подряд')
  expect(formatStreak(3)).toBe('3 дня подряд')
  expect(formatStreak(11)).toBe('11 дней подряд')
  expect(formatStreak(21)).toBe('21 день подряд')
})

test('describes the schedule in the words the person chose', () => {
  expect(describeSchedule(habit())).toBe('каждый день')
  expect(describeSchedule(habit({ schedule: 'weekdays', weekdays: [1, 3] }))).toBe('пн, ср')
  expect(describeSchedule(habit({ schedule: 'interval', intervalDays: 3 }))).toBe('каждые 3 дн.')
})
