// The interface is Russian only (§16 of PRD.md), so every date reads `21.09.2026` whatever the
// browser or OS locale says. One formatter for the whole app keeps screens from disagreeing.
const uiLocale = 'ru-RU'

const dateFormatter = new Intl.DateTimeFormat(uiLocale, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const dayDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Formats a day as `21.09.2026`.
 *
 * A `YYYY-MM-DD` string is a calendar day, not a moment, and is printed as written: parsing it
 * as a Date would drag in a time zone and could shift it to the previous day. Any other value is
 * a moment and is shown as the calendar day it falls on in the viewer's zone.
 */
export function formatDate(value: Date | string): string {
  if (typeof value === 'string') {
    const match = dayDatePattern.exec(value)
    if (match) return `${match[3]}.${match[2]}.${match[1]}`
  }
  return dateFormatter.format(value instanceof Date ? value : new Date(value))
}

const monthsGenitive = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

const monthsNominative = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

/** Sunday first, matching `Date.getUTCDay`. */
const weekdayNames = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
]

/**
 * `22 сентября, вторник` for a `YYYY-MM-DD` day. The owner allowed words only in the day
 * heading and the calendar, where the weekday stands next to the date; everywhere else the
 * date is `21.09.2026`.
 */
export function formatDayHeading(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  const month = monthsGenitive[parsed.getUTCMonth()] ?? ''
  const weekday = weekdayNames[parsed.getUTCDay()] ?? ''
  return `${parsed.getUTCDate()} ${month}, ${weekday}`
}

/** `Сентябрь 2026` for a `YYYY-MM` month. */
export function formatMonthYear(month: string): string {
  const [year, index] = month.split('-').map(Number)
  return `${monthsNominative[(index ?? 1) - 1] ?? ''} ${year}`
}
