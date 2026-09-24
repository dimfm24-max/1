import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { browserTimeZone } from './local-day'
import { useSettingsQuery, useUpdateSettingsMutation } from './queries'

// Per-device memory, deliberately in this browser only: a laptop at home and a phone on a trip
// should each decide for themselves, or they would flip the saved zone back and forth.
const keepKey = 'dilife_time_zone_keep'
const lastChangeKey = 'dilife_time_zone_changed_at'
const dayMs = 24 * 60 * 60 * 1000

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage can be blocked; the zone then may be offered again next time, which is harmless.
  }
}

/**
 * Keeps the saved time zone in step with the browser, as the owner decided: the zone changes by
 * itself and the person is told, with a way to undo it. A new account gets its first zone the
 * same way, silently. Renders nothing.
 */
export function TimeZoneSync() {
  const settings = useSettingsQuery()
  const update = useUpdateSettingsMutation()
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current || !settings.isSuccess) return
    if (document.visibilityState !== 'visible') return

    const detected = browserTimeZone()
    const saved = settings.data.settings.timeZone ?? null
    if (!detected || detected === saved) return
    if (saved !== null) {
      if (readStorage(keepKey) === saved) return
      const lastChange = Number(readStorage(lastChangeKey) ?? '0')
      if (Date.now() - lastChange < dayMs) return
    }

    attempted.current = true
    update.mutate(
      { timeZone: detected },
      {
        onSuccess: () => {
          if (saved === null) return
          writeStorage(lastChangeKey, String(Date.now()))
          toast(`Часовой пояс сменён на ${detected}`, {
            description: 'День и напоминания теперь считаются по нему.',
            action: {
              label: 'Вернуть',
              onClick: () => {
                writeStorage(keepKey, saved)
                update.mutate({ timeZone: saved })
              },
            },
          })
        },
        // The server may not know a zone the browser does (Europe/Kyiv against Europe/Kiev). It
        // is then left as it was; the zone can be picked from the list in the profile.
      },
    )
  }, [settings.isSuccess, settings.data, update])

  return null
}
