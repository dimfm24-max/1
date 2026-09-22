import type { StatisticsPeriod, StatisticsResponse } from '@dilife/contracts'

/** The one thing this module does: count a window of days for one person. */
export type StatisticsReader = {
  read(userId: string, period: StatisticsPeriod, today: string): Promise<StatisticsResponse>
}
