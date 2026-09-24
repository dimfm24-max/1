/** The greeting for an hour on the viewer's own clock. */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Доброе утро'
  if (hour >= 12 && hour < 17) return 'Добрый день'
  if (hour >= 17 && hour < 23) return 'Добрый вечер'
  return 'Доброй ночи'
}

/** `minuteOfDay` is on the person's own clock, by their time zone. */
export function todayHeadline(minuteOfDay: number, displayName: string | null): string {
  const name = displayName?.trim()
  const greeting = greetingFor(Math.floor(minuteOfDay / 60))
  return name ? `${greeting}, ${name}!` : `${greeting}!`
}

