import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SettingsWithClockResponse, UpdateSettingsRequest } from '@dilife/contracts'
import { useEffect, useState } from 'react'

import { sessionQueryKeys, useAuth } from '@/features/auth'
import type { AuthenticatedTransport } from '@/platform/api'
import { fetchSettings, updateSettings } from './api'
import { browserTimeZone, effectiveTimeZone, planDate, wallClock } from './local-day'

// Session-scoped, so signing out drops one account's settings instead of showing the next.
export const settingsQueryKeys = {
  all: [...sessionQueryKeys.all, 'settings'] as const,
  current: () => [...sessionQueryKeys.all, 'settings', 'current'] as const,
}

export function settingsQueryOptions(transport: AuthenticatedTransport) {
  return queryOptions({
    queryKey: settingsQueryKeys.current(),
    queryFn: ({ signal }) => fetchSettings(transport, { signal }),
  })
}

export function useSettingsQuery() {
  const auth = useAuth()
  return useQuery(settingsQueryOptions(auth.transport))
}

/**
 * Writes settings and refreshes everything that reads them. The day context carries a copy of
 * the settings, and every screen keyed by "today" may now be on another day, so the whole
 * session cache is marked stale rather than guessing which screens care.
 */
export function useUpdateSettingsMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateSettingsRequest) => updateSettings(auth.transport, input),
    onSuccess: (response) => {
      queryClient.setQueryData<SettingsWithClockResponse>(settingsQueryKeys.current(), response)
      void queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.all,
        predicate: (query) => query.queryKey[1] !== 'settings' && query.queryKey[1] !== 'auth',
      })
    },
  })
}

export type Today = {
  /** `YYYY-MM-DD` of the plan the person is living now. */
  today: string
  /** Minutes past midnight on the person's wall clock. */
  minuteOfDay: number
  /** The zone the answer was worked out in. */
  timeZone: string
}

/**
 * The person's "today" and wall clock, the one source every screen uses. It follows the saved
 * zone and day start, and it ticks, so an open tab turns over to the new day by itself when the
 * day starts. Until the settings arrive it answers in the browser's own zone.
 */
export function useToday(): Today {
  const settings = useSettingsQuery()
  const now = useTickingClock()
  const rule = settings.data?.settings ?? {
    timeZone: browserTimeZone(),
    dayStartMinute: 0,
  }
  const timeZone = effectiveTimeZone(rule.timeZone)
  return {
    today: planDate(now, rule),
    minuteOfDay: wallClock(now, timeZone).minuteOfDay,
    timeZone,
  }
}

/** The current moment, refreshed often enough for a "now" mark that moves by the minute. */
function useTickingClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  return now
}
