import type { StatisticsPeriod } from '@dilife/contracts'

/**
 * The span a period covers, counted back from today inclusive.
 *
 * Fixed lengths rather than calendar boundaries: "this month" on the 2nd would compare two days
 * against a whole month and read as collapse. A rolling window always compares like with like.
 */
export function periodWindow(
  period: StatisticsPeriod,
  today: string,
): { from: string; to: string; days: number } {
  const days = period === 'week' ? 7 : period === 'month' ? 30 : 365
  return { from: shiftDate(today, -(days - 1)), to: today, days }
}

export function shiftDate(date: string, days: number): string {
  const dayMs = 24 * 60 * 60 * 1000
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * dayMs)
    .toISOString()
    .slice(0, 10)
}

/** Every date in the window, oldest first, so a chart has a point for a day with nothing in it. */
export function eachDay(from: string, days: number): string[] {
  return Array.from({ length: days }, (_, index) => shiftDate(from, index))
}
