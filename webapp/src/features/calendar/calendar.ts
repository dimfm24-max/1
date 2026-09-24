import { shiftDay } from '@/features/day'

/**
 * Laying out a month. The calendar shows what is already written elsewhere - tasks, goal
 * deadlines - so this file only does the arithmetic of the grid.
 */

export type CalendarCell = {
  date: string
  isCurrentMonth: boolean
  isToday: boolean
}

export const weekdayHeadings = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

/**
 * Six weeks starting on Monday, always. A grid that changes height between months makes
 * everything below it jump, and a person comparing two months should not have to re-find the
 * controls.
 */
export function monthGrid(month: string, today: string): CalendarCell[] {
  const first = `${month}-01`
  const firstWeekday = new Date(`${first}T00:00:00.000Z`).getUTCDay()
  // Monday is 0 in this grid; JavaScript puts Sunday at 0.
  const leading = (firstWeekday + 6) % 7
  const start = shiftDay(first, -leading)

  return Array.from({ length: 42 }, (_, index) => {
    const date = shiftDay(start, index)
    return {
      date,
      isCurrentMonth: date.startsWith(month),
      isToday: date === today,
    }
  })
}

export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function shiftMonth(month: string, months: number): string {
  const [year, index] = month.split('-').map(Number)
  const moved = new Date(Date.UTC(year!, (index! - 1) + months, 1))
  return moved.toISOString().slice(0, 7)
}

export { formatMonthYear as formatMonth } from '@/platform/intl'

export function dayOfMonth(date: string): number {
  return Number(date.slice(8, 10))
}
