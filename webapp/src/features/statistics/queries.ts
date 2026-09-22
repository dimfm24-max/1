import { queryOptions, useQuery } from '@tanstack/react-query'
import type { StatisticsPeriod } from '@dilife/contracts'

import { sessionQueryKeys, useAuth } from '@/features/auth'
import type { AuthenticatedTransport } from '@/platform/api'
import { fetchStatistics } from './api'

export const statisticsQueryKeys = {
  window: (period: StatisticsPeriod, today: string) =>
    [...sessionQueryKeys.all, 'statistics', period, today] as const,
}

export function statisticsQueryOptions(
  transport: AuthenticatedTransport,
  period: StatisticsPeriod,
  today: string,
) {
  return queryOptions({
    queryKey: statisticsQueryKeys.window(period, today),
    queryFn: ({ signal }) => fetchStatistics(transport, period, today, { signal }),
  })
}

export function useStatisticsQuery(period: StatisticsPeriod, today: string) {
  const auth = useAuth()

  return useQuery(statisticsQueryOptions(auth.transport, period, today))
}
