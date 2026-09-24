import type { HabitDto } from '@dilife/contracts'

import { shiftDay } from '@/features/day'
import { formatCount } from '@/platform/intl'

/** A day in the strip: whether the habit was due, whether it was kept, and how to label it. */
export type HabitDay = {
  date: string
  isDue: boolean
  isDone: boolean
  isToday: boolean
  weekdayLabel: string
}

const weekdayLabels = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

/**
 * The last `length` days, oldest first. Showing the run rather than a single checkbox is the
 * point of a habit screen: a person keeps going because the strip is unbroken, and a strip they
 * cannot see does not pull at them.
 */
export function habitStrip(habit: HabitDto, today: string, length = 14): HabitDay[] {
  const marks = new Set(habit.marks)
  const days: HabitDay[] = []

  for (let offset = length - 1; offset >= 0; offset -= 1) {
    const date = shiftDay(today, -offset)
    days.push({
      date,
      isDue: isDueOn(habit, date),
      isDone: marks.has(date),
      isToday: date === today,
      weekdayLabel: weekdayLabels[new Date(`${date}T00:00:00.000Z`).getUTCDay()] ?? '',
    })
  }

  return days
}

/**
 * Whether the habit is expected on that day. The same rule as the backend, because the strip has
 * to render before any write and cannot wait for the server to say which squares are grey.
 */
export function isDueOn(habit: HabitDto, date: string): boolean {
  const offset = daysBetween(habit.startedOn, date)
  if (offset < 0) return false
  if (habit.schedule === 'daily') return true
  if (habit.schedule === 'weekdays') {
    return habit.weekdays.includes(new Date(`${date}T00:00:00.000Z`).getUTCDay())
  }
  return habit.intervalDays > 0 && offset % habit.intervalDays === 0
}

function daysBetween(from: string, to: string) {
  const dayMs = 24 * 60 * 60 * 1000
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / dayMs,
  )
}

/** Russian day agreement for a streak: 1 день, 2 дня, 5 дней. */
export function formatStreak(days: number): string {
  if (days === 0) return 'серия прервана'
  return `${formatCount(days, ['день', 'дня', 'дней'])} подряд`
}

export function describeSchedule(habit: HabitDto): string {
  if (habit.schedule === 'daily') return 'каждый день'
  if (habit.schedule === 'weekdays') {
    const days = [...habit.weekdays].sort().map((day) => weekdayLabels[day] ?? '')
    return days.length === 0 ? 'дни не выбраны' : days.join(', ')
  }
  return habit.intervalDays === 1 ? 'каждый день' : `каждые ${habit.intervalDays} дн.`
}

/**
 * The habits worth showing off: active ones, longest current run first, ties kept in the
 * person's own order. Archived habits keep their history but no longer ask for attention.
 */
export function topStreaks(habits: ReadonlyArray<HabitDto>, limit: number): HabitDto[] {
  return habits
    .filter((habit) => habit.archivedAt === null)
    .toSorted(
      (left, right) =>
        right.currentStreak - left.currentStreak || left.position - right.position,
    )
    .slice(0, limit)
}
