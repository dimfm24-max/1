/**
 * The zones a person can pick from, with their current offset, for the list with search in the
 * profile. The browser supplies the IANA names; a browser that cannot list them offers the
 * saved zone and the fallback, which is enough to keep the field usable.
 */
export type TimeZoneOption = {
  zone: string
  /** `UTC+3`, `UTC−3:30`: the offset right now, for reading and for search. */
  offset: string
  /** The Russian city name for zones people here pick most, so «Москва» finds Europe/Moscow. */
  city: string | null
  label: string
}

const russianNames: Record<string, string> = {
  'Europe/Kaliningrad': 'Калининград',
  'Europe/Moscow': 'Москва',
  'Europe/Volgograd': 'Волгоград',
  'Europe/Samara': 'Самара',
  'Asia/Yekaterinburg': 'Екатеринбург',
  'Asia/Omsk': 'Омск',
  'Asia/Novosibirsk': 'Новосибирск',
  'Asia/Krasnoyarsk': 'Красноярск',
  'Asia/Irkutsk': 'Иркутск',
  'Asia/Yakutsk': 'Якутск',
  'Asia/Vladivostok': 'Владивосток',
  'Asia/Magadan': 'Магадан',
  'Asia/Kamchatka': 'Камчатка',
  'Europe/Minsk': 'Минск',
  'Europe/Kyiv': 'Киев',
  'Asia/Almaty': 'Алматы',
  'Asia/Tashkent': 'Ташкент',
  'Asia/Tbilisi': 'Тбилиси',
  'Asia/Yerevan': 'Ереван',
  'Asia/Baku': 'Баку',
  'Europe/Istanbul': 'Стамбул',
  'Europe/Berlin': 'Берлин',
  'Europe/London': 'Лондон',
  'Asia/Dubai': 'Дубай',
  'Asia/Bangkok': 'Бангкок',
  'America/New_York': 'Нью-Йорк',
}

export function timeZoneOptions(
  extra: ReadonlyArray<string | null | undefined>,
  now = new Date(),
): TimeZoneOption[] {
  const zones = new Set(supportedZones())
  for (const zone of extra) if (zone) zones.add(zone)
  return [...zones]
    .map((zone) => {
      const offset = zoneOffset(zone, now)
      const city = russianNames[zone] ?? null
      return { zone, offset, city, label: `${city ? `${city} — ` : ''}${zone} (${offset})` }
    })
    .sort((left, right) => left.zone.localeCompare(right.zone))
}

function supportedZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] }
  try {
    return intl.supportedValuesOf?.('timeZone') ?? []
  } catch {
    return []
  }
}

export function zoneOffset(zone: string, now = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
      .formatToParts(now)
      .find((item) => item.type === 'timeZoneName')?.value
    if (!part || part === 'GMT') return 'UTC+0'
    return part.replace('GMT', 'UTC').replace('-', '−')
  } catch {
    return 'UTC'
  }
}

/** Search by any part of the name, the Russian city or the offset: «моск», «Moscow», «+3». */
export function matchesTimeZone(option: TimeZoneOption, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return (
    option.zone.toLowerCase().replaceAll('_', ' ').includes(needle.replaceAll('_', ' ')) ||
    (option.city?.toLowerCase().includes(needle) ?? false) ||
    option.offset.toLowerCase().includes(needle.replace('-', '−'))
  )
}
