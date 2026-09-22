import { statisticsResponseSchema, type StatisticsPeriod } from '@dilife/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

export function fetchStatistics(
  transport: AuthenticatedTransport,
  period: StatisticsPeriod,
  today: string,
  options?: { signal?: AbortSignal },
) {
  return transport.request(
    `/api/statistics?period=${period}&today=${today}`,
    statisticsResponseSchema,
    { signal: options?.signal },
  )
}
