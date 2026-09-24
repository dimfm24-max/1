import type { ScheduleRuleDto, TaskDto } from '@dilife/contracts'

import { describeWeekdays, formatDate, pluralForm } from '@/platform/intl'

// The formatters live in platform/intl; they are re-exported here because the day screens and
// their tests already import them from the day feature.
export { formatDayHeading, formatDuration, formatMinuteOfDay } from '@/platform/intl'

/**
 * Reading a day for the screen. The rules are here rather than in the components so the plan,
 * the evening summary and the header cannot disagree about what counts as done.
 */

export type DayCounts = {
  total: number
  done: number
  burned: number
  unresolved: number
  donePercent: number
}

export function countDay(tasks: ReadonlyArray<TaskDto>): DayCounts {
  const done = tasks.filter((task) => task.outcome === 'done').length
  const burned = tasks.filter((task) => task.outcome === 'burned').length
  const unresolved = tasks.filter((task) => task.outcome === 'planned').length

  return {
    total: tasks.length,
    done,
    burned,
    unresolved,
    // Burned tasks count against the day: letting something go is an outcome, not a discount.
    donePercent: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
  }
}

/** The word that agrees with a count of tasks: 1 задача, 2 задачи, 5 задач. */
export function taskWord(count: number): string {
  return pluralForm(count, ['задача', 'задачи', 'задач'])
}

/** `YYYY-MM-DD` for a date in the viewer's own zone, which is the day they call today. */
export function toDayDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftDay(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

export function relativeDayLabel(date: string, today: string): string | null {
  if (date === today) return 'сегодня'
  if (date === shiftDay(today, 1)) return 'завтра'
  if (date === shiftDay(today, -1)) return 'вчера'
  return null
}

/** «по пн, ср, пт» or «12.10, 19.10» for a repeat rule. */
export function describeRepeat(rule: ScheduleRuleDto): string {
  switch (rule.kind) {
    case 'daily':
      return 'каждый день'
    case 'weekdays':
      return `по дням: ${describeWeekdays(rule.weekdays)}`
    case 'monthdays':
      return `по числам: ${rule.monthDays.join(', ')}`
    case 'dates':
      return `в даты: ${rule.dates.map(formatDate).join(', ')}`
  }
}
