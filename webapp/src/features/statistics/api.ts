import { statisticsResponseSchema, type StatisticsPeriod } from '@dilife/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

export function fetchStatistics(
  transport: AuthenticatedTransport,
  period: StatisticsPeriod,
  options?: { signal?: AbortSignal },
) {
  return transport.request(
    `/api/statistics?period=${period}`,
    statisticsResponseSchema,
    { signal: options?.signal },
  )
}
