import { z } from 'zod'

import { dayDateSchema } from './day'

/**
 * Statistics over a window of days. Everything is counted on the server: the client asks for a
 * period and renders what comes back, so two screens can never disagree about what a week was.
 */

export const statisticsPeriodSchema = z.enum(['week', 'month', 'year'])

export const dailyPointSchema = z.object({
  date: z.string(),
  planned: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
  burned: z.number().int().nonnegative(),
})

export const goalTimeSchema = z.object({
  goalId: z.string(),
  title: z.string(),
  minutes: z.number().int().nonnegative(),
  completedSteps: z.number().int().nonnegative(),
})

export const habitStreakSchema = z.object({
  habitId: z.string(),
  title: z.string(),
  currentStreak: z.number().int().nonnegative(),
  markedDays: z.number().int().nonnegative(),
})

export const statisticsResponseSchema = z
  .object({
    period: statisticsPeriodSchema,
    from: z.string(),
    to: z.string(),
    totals: z.object({
      planned: z.number().int().nonnegative(),
      done: z.number().int().nonnegative(),
      burned: z.number().int().nonnegative(),
      doneMinutes: z.number().int().nonnegative(),
      /** Days in the window with at least one task done. The habit of showing up at all. */
      activeDays: z.number().int().nonnegative(),
    }),
    daily: z.array(dailyPointSchema),
    goals: z.array(goalTimeSchema),
    habits: z.array(habitStreakSchema),
  })
  .strict()

export const statisticsQuerySchema = z
  .object({
    period: statisticsPeriodSchema.default('week'),
    /** Ignored: the server works the day out from the person's settings. Kept for old tabs. */
    today: dayDateSchema.optional(),
  })
  .strict()

export type StatisticsPeriod = z.infer<typeof statisticsPeriodSchema>
export type DailyPoint = z.infer<typeof dailyPointSchema>
export type StatisticsResponse = z.infer<typeof statisticsResponseSchema>
