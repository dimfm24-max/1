/** 510 reads as `08:30`. Minutes past midnight is how a day is stored; this is how it is said. */
export function formatMinuteOfDay(minute: number): string {
  const normalized = ((minute % 1440) + 1440) % 1440
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * Reads `8:30`, `08:30` or `830` as minutes past midnight, 24-hour clock only.
 * Returns null for anything that is not a real time of day.
 */
export function parseMinuteOfDay(text: string): number | null {
  const trimmed = text.trim()
  const match = /^(\d{1,2})(?::|\.)?(\d{2})$/.exec(trimmed)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/** `45 мин`, `1 ч`, `1 ч 30 мин`. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`
}
