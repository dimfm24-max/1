import { z } from 'zod'

import { dayDateSchema, colorSchema } from './day'

/**
 * Habits. A habit is an action expected on certain days; a mark says it was done on one of them.
 *
 * Only completion is recorded. A missed day is not written down, because the schedule already
 * says which days were expected - storing failures as rows would make the absence of a row
 * ambiguous and the history heavier for no gain.
 */

export const HABIT_TITLE_MAX = 200

export const habitScheduleSchema = z.enum(['daily', 'weekdays', 'interval'])

/** 0 is Sunday, matching `Date.getDay`, so no translation is needed at either end. */
const weekdaySchema = z.number().int().min(0).max(6)

export const habitSchema = z.object({
  id: z.string(),
  title: z.string(),
  schedule: habitScheduleSchema,
  weekdays: z.array(weekdaySchema),
  intervalDays: z.number().int().positive(),
  startedOn: z.string(),
  archivedAt: z.string().datetime().nullable(),
  color: z.string().nullable(),
  position: z.number().int().nonnegative(),
  /** The days it was done, most recent first, bounded by the window the server was asked for. */
  marks: z.array(z.string()),
  currentStreak: z.number().int().nonnegative(),
  longestStreak: z.number().int().nonnegative(),
})

export const habitsResponseSchema = z.object({ habits: z.array(habitSchema) }).strict()
export const habitResponseSchema = z.object({ habit: habitSchema }).strict()

export const createHabitRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(HABIT_TITLE_MAX),
    schedule: habitScheduleSchema.default('daily'),
    weekdays: z.array(weekdaySchema).max(7).optional(),
    intervalDays: z.number().int().positive().max(365).optional(),
    startedOn: dayDateSchema,
    color: z.union([colorSchema, z.null()]).optional(),
  })
  .strict()
  .refine(
    (value) => value.schedule !== 'weekdays' || (value.weekdays?.length ?? 0) > 0,
    { message: 'Выбери хотя бы один день недели', path: ['weekdays'] },
  )

export const updateHabitRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(HABIT_TITLE_MAX).optional(),
    schedule: habitScheduleSchema.optional(),
    weekdays: z.array(weekdaySchema).max(7).optional(),
    intervalDays: z.number().int().positive().max(365).optional(),
    color: z.union([colorSchema, z.null()]).optional(),
    isArchived: z.boolean().optional(),
  })
  .strict()

/** Marking is idempotent by day: the same day twice is the same fact, not two. */
export const markHabitRequestSchema = z
  .object({
    markedOn: dayDateSchema,
    isDone: z.boolean(),
  })
  .strict()

export const habitIdParamsSchema = z.object({ habitId: z.uuid() }).strict()

export type HabitSchedule = z.infer<typeof habitScheduleSchema>
export type HabitDto = z.infer<typeof habitSchema>
export type HabitsResponse = z.infer<typeof habitsResponseSchema>
export type CreateHabitRequest = z.infer<typeof createHabitRequestSchema>
export type UpdateHabitRequest = z.infer<typeof updateHabitRequestSchema>
export type MarkHabitRequest = z.infer<typeof markHabitRequestSchema>
