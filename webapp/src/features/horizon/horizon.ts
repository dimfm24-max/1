/**
 * The life horizon: how much time is ahead, from a date of birth and an expected age.
 *
 * Everything here is arithmetic on dates the person entered themselves. Nothing is inferred, and
 * nothing is stored beyond those two values - the counts are derived on every render so they can
 * never go stale in a cache and show someone the wrong number of weeks.
 */

export type Horizon = {
  livedWeeks: number
  totalWeeks: number
  remainingWeeks: number
  remainingDays: number
  remainingMonths: number
  remainingYears: number
  livedPercent: number
  /** True once the expected age is behind the person. The screen says so plainly. */
  isPast: boolean
}

const dayMs = 24 * 60 * 60 * 1000

export function describeHorizon(
  birthDate: string,
  lifeExpectancy: number,
  today: string,
): Horizon {
  const birth = Date.parse(`${birthDate}T00:00:00.000Z`)
  const now = Date.parse(`${today}T00:00:00.000Z`)

  const end = new Date(birth)
  end.setUTCFullYear(end.getUTCFullYear() + lifeExpectancy)
  const endMs = end.getTime()

  const totalDays = Math.max(Math.round((endMs - birth) / dayMs), 1)
  const livedDays = Math.max(Math.round((now - birth) / dayMs), 0)
  const remainingDays = Math.max(Math.round((endMs - now) / dayMs), 0)

  return {
    livedWeeks: Math.floor(livedDays / 7),
    totalWeeks: Math.ceil(totalDays / 7),
    remainingWeeks: Math.floor(remainingDays / 7),
    remainingDays,
    // Calendar months and years, rounded down: a person reads "осталось 23 года" as a whole
    // number of birthdays left, not as a fraction.
    remainingMonths: Math.floor(remainingDays / 30.44),
    remainingYears: Math.floor(remainingDays / 365.25),
    livedPercent: Math.min(Math.round((livedDays / totalDays) * 100), 100),
    isPast: remainingDays === 0,
  }
}

export { formatCount } from '@/platform/intl'

export const unitForms = {
  years: ['год', 'года', 'лет'] as const,
  months: ['месяц', 'месяца', 'месяцев'] as const,
  weeks: ['неделя', 'недели', 'недель'] as const,
  days: ['день', 'дня', 'дней'] as const,
}
