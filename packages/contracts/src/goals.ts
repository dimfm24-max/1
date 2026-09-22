import { z } from 'zod'

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

const titleSchema = z.string().trim().min(1).max(GOAL_TITLE_MAX)
const descriptionSchema = z.union([z.string().trim().min(1), z.null()])
const valueSchema = z.number().finite().min(0).max(GOAL_VALUE_MAX)

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
  estimatedMinutes: z.number().int().positive().nullable(),
  completedAt: z.string().datetime().nullable(),
  position: z.number().int().nonnegative(),
})

export const stageSchema = z.object({
  id: z.string(),
  title: z.string(),
  position: z.number().int().nonnegative(),
  steps: z.array(stepSchema),
})

export const goalSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  deadline: z.string().datetime(),
  measureUnit: z.string(),
  targetValue: z.number(),
  currentValue: z.number(),
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

export const createGoalRequestSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema.optional(),
    deadline: z.string().datetime(),
    measureUnit: z.string().trim().min(1).max(GOAL_MEASURE_UNIT_MAX),
    targetValue: valueSchema,
    progressMode: goalProgressModeSchema.default('manual'),
  })
  .strict()

export const updateGoalRequestSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    deadline: z.string().datetime().optional(),
    measureUnit: z.string().trim().min(1).max(GOAL_MEASURE_UNIT_MAX).optional(),
    targetValue: valueSchema.optional(),
    progressMode: goalProgressModeSchema.optional(),
  })
  .strict()

/** Recording progress by hand. Refused in automatic mode, where steps own the number. */
export const recordGoalProgressRequestSchema = z
  .object({
    currentValue: valueSchema,
  })
  .strict()

/**
 * Closing a goal. The outcome note is the point of the ceremony: what came of it, in the
 * person's own words. It is optional so that closing is never blocked by a blank page.
 */
export const closeGoalRequestSchema = z
  .object({
    status: z.enum(['completed', 'abandoned']),
    outcomeNote: z.union([z.string().trim().min(1), z.null()]).optional(),
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
  })
  .strict()

export const updateStageRequestSchema = z
  .object({
    title: titleSchema,
  })
  .strict()

export const createStepRequestSchema = z
  .object({
    title: titleSchema,
    estimatedMinutes: z.number().int().positive().max(24 * 60).nullable().optional(),
  })
  .strict()

export const updateStepRequestSchema = z
  .object({
    title: titleSchema.optional(),
    estimatedMinutes: z.number().int().positive().max(24 * 60).nullable().optional(),
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
export type UpsertLifeGoalRequest = z.infer<typeof upsertLifeGoalRequestSchema>
export type CreateGoalRequest = z.infer<typeof createGoalRequestSchema>
export type UpdateGoalRequest = z.infer<typeof updateGoalRequestSchema>
export type RecordGoalProgressRequest = z.infer<typeof recordGoalProgressRequestSchema>
export type CloseGoalRequest = z.infer<typeof closeGoalRequestSchema>
export type CreateStageRequest = z.infer<typeof createStageRequestSchema>
export type UpdateStageRequest = z.infer<typeof updateStageRequestSchema>
export type CreateStepRequest = z.infer<typeof createStepRequestSchema>
export type UpdateStepRequest = z.infer<typeof updateStepRequestSchema>
