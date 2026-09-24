import { z } from 'zod'

/**
 * Public sharing. One link per person, revocable, opening a read-only page anyone who knows the
 * address can see and comment on.
 *
 * The token is the whole of the permission, so the page carries only what the owner chose to
 * show and nothing that identifies the account behind it: no email, no id.
 */

export const shareSettingsSchema = z.object({
  token: z.string().nullable(),
  showsGoals: z.boolean(),
  showsHabits: z.boolean(),
  showsStatistics: z.boolean(),
})

export const shareSettingsResponseSchema = z.object({ share: shareSettingsSchema }).strict()

export const updateShareRequestSchema = z
  .object({
    showsGoals: z.boolean().optional(),
    showsHabits: z.boolean().optional(),
    showsStatistics: z.boolean().optional(),
  })
  .strict()

export const publicGoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** `YYYY-MM-DD`. */
  deadline: z.string(),
  measureUnit: z.string(),
  targetValue: z.number(),
  currentValue: z.number(),
  status: z.enum(['active', 'completed', 'abandoned']),
  completedSteps: z.number().int().nonnegative(),
  totalSteps: z.number().int().nonnegative(),
})

export const publicHabitSchema = z.object({
  id: z.string(),
  title: z.string(),
  currentStreak: z.number().int().nonnegative(),
})

export const shareCommentSchema = z.object({
  id: z.string(),
  authorName: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
})

export const publicProfileResponseSchema = z
  .object({
    displayName: z.string().nullable(),
    lifeGoalTitle: z.string().nullable(),
    goals: z.array(publicGoalSchema).nullable(),
    habits: z.array(publicHabitSchema).nullable(),
    statistics: z
      .object({
        done: z.number().int().nonnegative(),
        activeDays: z.number().int().nonnegative(),
      })
      .nullable(),
    comments: z.array(shareCommentSchema),
  })
  .strict()

export const createCommentRequestSchema = z
  .object({
    authorName: z.string().trim().min(1).max(80),
    body: z.string().trim().min(1).max(2000),
  })
  .strict()

export const shareTokenParamsSchema = z.object({ token: z.string().min(16).max(64) }).strict()
export const commentIdParamsSchema = z.object({ commentId: z.uuid() }).strict()

export type ShareSettingsDto = z.infer<typeof shareSettingsSchema>
export type PublicProfileResponse = z.infer<typeof publicProfileResponseSchema>
export type ShareCommentDto = z.infer<typeof shareCommentSchema>
export type UpdateShareRequest = z.infer<typeof updateShareRequestSchema>
export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>
