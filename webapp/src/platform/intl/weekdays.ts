/** Monday first, as a Russian week reads; values count 0-6 from Sunday, as the server does. */
export const weekdaysMondayFirst = [
  { value: 1, short: 'Пн', name: 'понедельник' },
  { value: 2, short: 'Вт', name: 'вторник' },
  { value: 3, short: 'Ср', name: 'среда' },
  { value: 4, short: 'Чт', name: 'четверг' },
  { value: 5, short: 'Пт', name: 'пятница' },
  { value: 6, short: 'Сб', name: 'суббота' },
  { value: 0, short: 'Вс', name: 'воскресенье' },
] as const

/** «пн, ср, пт» for a list of weekdays counted from Sunday. */
export function describeWeekdays(days: ReadonlyArray<number>): string {
  if (days.length === 7) return 'каждый день'
  return weekdaysMondayFirst
    .filter((day) => days.includes(day.value))
    .map((day) => day.short.toLowerCase())
    .join(', ')
}
