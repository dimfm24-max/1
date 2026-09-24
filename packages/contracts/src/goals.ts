import { z } from 'zod'

import { dayDateSchema } from './day'

/**
 * Goal tree contracts: life goal → goal → stage → step.
 *
 * The tree is the product: a day is planned out of steps, and a step only exists inside a stage
 * of a goal that belongs to the one life goal. The nesting is fixed at four levels on purpose -
 * arbitrary depth would let a person hide work from the day plan without ever naming a goal.
 *
 * Every write here is scoped to the signed-in owner. The contracts carry no owner id: the server
 * takes it from the session, so a client cannot address another person's tree by guessing ids.
 */

export const GOAL_TITLE_MAX = 200
export const GOAL_MEASURE_UNIT_MAX = 40
/** Progress is a plain number a person types: kilograms, pages, sessions. */
export const GOAL_VALUE_MAX = 1_000_000_000

/** How many days before the deadline a goal starts to warn, unless the person picks another. */
export const DEFAULT_DEADLINE_WARNING_DAYS = 3
export const DEADLINE_WARNING_DAYS_MAX = 365
/** Descriptions have no limit of their own (§14); this only stops a runaway paste. */
export const DESCRIPTION_MAX = 100_000

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Напиши название')
  .max(GOAL_TITLE_MAX, 'Название — не длиннее 200 знаков')
const descriptionSchema = z.union([z.string().trim().min(1).max(DESCRIPTION_MAX), z.null()])
const valueSchema = z.number().finite().min(0).max(GOAL_VALUE_MAX)
const estimatedMinutesSchema = z.number().int().positive().max(24 * 60)
const deadlineWarningDaysSchema = z.number().int().min(0).max(DEADLINE_WARNING_DAYS_MAX)

/**
 * A deadline is a calendar day, `YYYY-MM-DD`, so it reads the same date in every time zone.
 * Clients released before that sent an ISO moment; its date part is taken for one release.
 */
export const deadlineInputSchema = z.union([
  dayDateSchema,
  z
    .string()
    .datetime()
    .transform((moment) => moment.slice(0, 10)),
])

/**
 * Who moves the number. `manual` means the person records it; `automatic` derives it from the
 * share of completed steps, so the same field means different things and must not be writable
 * by hand in automatic mode.
 */
export const goalProgressModeSchema = z.enum(['manual', 'automatic'])

/**
 * `abandoned` is not a failure state to hide: a goal deliberately dropped stays readable in the
 * archive, because the reason it was dropped is worth as much as the ones that were finished.
 */
export const goalStatusSchema = z.enum(['active', 'completed', 'abandoned'])

export const stepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable(),
  completedAt: z.string().datetime().nullable(),
  position: z.number().int().nonnegative(),
})

export const stageSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  position: z.number().int().nonnegative(),
  steps: z.array(stepSchema),
})

export const goalSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  /** `YYYY-MM-DD`. */
  deadline: z.string(),
  measureUnit: z.string(),
  targetValue: z.number(),
  currentValue: z.number(),
  /** "Сколько сейчас" when the goal was set; null counts from zero. Manual goals only. */
  initialValue: z.number().nullable().optional(),
  /**
   * The share of the way done, 0..1, computed on the server by the one formula every screen
   * shows. Optional only for responses from an older server.
   */
  progressRatio: z.number().min(0).max(1).optional(),
  /** Warn this many days before the deadline. */
  deadlineWarningDays: z.number().int().nonnegative().optional(),
  progressMode: goalProgressModeSchema,
  status: goalStatusSchema,
  isPrimary: z.boolean(),
  outcomeNote: z.string().nullable(),
  position: z.number().int().nonnegative(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  stages: z.array(stageSchema),
})

export const lifeGoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string().datetime(),
})

export const goalTreeResponseSchema = z
  .object({
    lifeGoal: lifeGoalSchema.nullable(),
    goals: z.array(goalSchema),
  })
  .strict()

/**
 * Deleting the life goal: its goals either go to the trash with it, or stay and wait for the
 * next life goal, which takes them back by itself (owner's decision on task 12).
 */
export const deleteLifeGoalRequestSchema = z
  .object({
    goals: z.enum(['trash', 'detach']),
  })
  .strict()

export const upsertLifeGoalRequestSchema = z
  .object({
    title: titleSchema,
  })
  .strict()

export const lifeGoalResponseSchema = z
  .object({
    lifeGoal: lifeGoalSchema,
  })
  .strict()

const newStepSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema.optional(),
    estimatedMinutes: estimatedMinutesSchema.nullable().optional(),
  })
  .strict()

const newStageSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema.optional(),
    steps: z.array(newStepSchema).max(200).default([]),
  })
  .strict()

/**
 * The number a goal runs to must differ from the one it starts at, or the bar could never move.
 * With no start the count runs from zero, so the target has to be above it. Only a manual goal
 * has a start: an automatic one counts steps.
 */
export function goalTargetProblem(input: {
  targetValue: number
  initialValue?: number | null
  progressMode: 'manual' | 'automatic'
}): string | null {
  const start = input.progressMode === 'manual' ? (input.initialValue ?? null) : null
  if (start === null) return input.targetValue > 0 ? null : 'Сколько нужно — больше нуля'
  return input.targetValue !== start ? null : 'Сколько нужно и сколько сейчас не могут совпадать'
}

export const createGoalRequestSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema.optional(),
    deadline: deadlineInputSchema,
    measureUnit: z.string().trim().min(1, 'Напиши единицу').max(GOAL_MEASURE_UNIT_MAX),
    targetValue: valueSchema,
    /** "Сколько сейчас" for a manual goal. */
    initialValue: valueSchema.nullable().optional(),
    /** Automatic by default: a completed step moves the goal (owner's decision on task 07). */
    progressMode: goalProgressModeSchema.default('automatic'),
    deadlineWarningDays: deadlineWarningDaysSchema.default(DEFAULT_DEADLINE_WARNING_DAYS),
    /** Stages and steps created with the goal in one transaction, as the wizard needs. */
    stages: z.array(newStageSchema).max(50).optional(),
    /** Makes the request safe to retry: the same key returns the goal already made. */
    creationKey: z.uuid().optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const problem = goalTargetProblem(input)
    if (problem) context.addIssue({ code: 'custom', message: problem, path: ['targetValue'] })
  })

export const updateGoalRequestSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    deadline: deadlineInputSchema.optional(),
    measureUnit: z.string().trim().min(1).max(GOAL_MEASURE_UNIT_MAX).optional(),
    targetValue: valueSchema.optional(),
    initialValue: valueSchema.nullable().optional(),
    progressMode: goalProgressModeSchema.optional(),
    deadlineWarningDays: deadlineWarningDaysSchema.optional(),
  })
  .strict()

/** One point of the goal's number over time. */
export const goalProgressEntrySchema = z.object({
  at: z.string().datetime(),
  value: z.number(),
  ratio: z.number(),
  /** manual, steps, target, mode, created, trash. Open set: unknown reasons read as a change. */
  reason: z.string(),
})

export const goalProgressHistoryResponseSchema = z
  .object({
    entries: z.array(goalProgressEntrySchema),
  })
  .strict()

/** A new order of a goal's stages, or of a stage's steps: every id, in the order wanted. */
export const reorderRequestSchema = z
  .object({
    ids: z.array(z.uuid()).min(1).max(500),
  })
  .strict()

/** Recording progress by hand. Refused in automatic mode, where steps own the number. */
export const recordGoalProgressRequestSchema = z
  .object({
    currentValue: valueSchema,
  })
  .strict()

/**
 * Closing a goal. The outcome note is the point of the ceremony: what came of it and what the
 * person understood, in their own words. Required (owner's decision on task 10).
 */
export const closeGoalRequestSchema = z
  .object({
    status: z.enum(['completed', 'abandoned']),
    outcomeNote: z
      .string()
      .trim()
      .min(1, 'Напиши итог: что получилось и что понял')
      .max(DESCRIPTION_MAX),
  })
  .strict()

export const goalResponseSchema = z
  .object({
    goal: goalSchema,
  })
  .strict()

export const createStageRequestSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema.optional(),
  })
  .strict()

export const updateStageRequestSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
  })
  .strict()

export const createStepRequestSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema.optional(),
    estimatedMinutes: estimatedMinutesSchema.nullable().optional(),
  })
  .strict()

export const updateStepRequestSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    estimatedMinutes: estimatedMinutesSchema.nullable().optional(),
    isCompleted: z.boolean().optional(),
  })
  .strict()

export const goalIdParamsSchema = z.object({ goalId: z.uuid() }).strict()
export const stageIdParamsSchema = z.object({ stageId: z.uuid() }).strict()
export const stepIdParamsSchema = z.object({ stepId: z.uuid() }).strict()

export type GoalProgressMode = z.infer<typeof goalProgressModeSchema>
export type GoalStatus = z.infer<typeof goalStatusSchema>
export type StepDto = z.infer<typeof stepSchema>
export type StageDto = z.infer<typeof stageSchema>
export type GoalDto = z.infer<typeof goalSchema>
export type LifeGoalDto = z.infer<typeof lifeGoalSchema>
export type GoalTreeResponse = z.infer<typeof goalTreeResponseSchema>
export type DeleteLifeGoalRequest = z.infer<typeof deleteLifeGoalRequestSchema>
export type GoalProgressEntryDto = z.infer<typeof goalProgressEntrySchema>
export type GoalProgressHistoryResponse = z.infer<typeof goalProgressHistoryResponseSchema>
export type ReorderRequest = z.infer<typeof reorderRequestSchema>
export type UpsertLifeGoalRequest = z.infer<typeof upsertLifeGoalRequestSchema>
export type CreateGoalRequest = z.infer<typeof createGoalRequestSchema>
export type UpdateGoalRequest = z.infer<typeof updateGoalRequestSchema>
export type RecordGoalProgressRequest = z.infer<typeof recordGoalProgressRequestSchema>
export type CloseGoalRequest = z.infer<typeof closeGoalRequestSchema>
export type CreateStageRequest = z.infer<typeof createStageRequestSchema>
export type UpdateStageRequest = z.infer<typeof updateStageRequestSchema>
export type CreateStepRequest = z.infer<typeof createStepRequestSchema>
export type UpdateStepRequest = z.infer<typeof updateStepRequestSchema>
