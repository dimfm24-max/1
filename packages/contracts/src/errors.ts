import { z } from 'zod'

export const apiErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION_ERROR',
  'AUTH_EMAIL_ALREADY_EXISTS',
  'AUTH_INVALID_PROVIDER_TOKEN',
  'AUTH_PROVIDER_ACCOUNT_ALREADY_LINKED',
  'AUTH_PROVIDER_EMAIL_REQUIRED',
  'AUTH_PROVIDER_NOT_CONFIGURED',
  'AUTH_PROVIDER_UNAVAILABLE',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'AUTH_PASSWORD_RESET_INVALID',
  'AUTH_EMAIL_VERIFICATION_INVALID',
  // Upload failures a client can actually recover from, kept apart from generic CONFLICT so the
  // UI can say what to do: retry the transfer, pick a different file, or start over.
  'UPLOAD_NOT_COMPLETED',
  'UPLOAD_REJECTED',
  'UPLOAD_EXPIRED',
  // Goal-tree refusals the interface can act on: create the life goal first, switch the goal
  // to manual before recording a value, or reopen a closed goal before editing it.
  'LIFE_GOAL_REQUIRED',
  'GOAL_PROGRESS_NOT_MANUAL',
  'GOAL_CLOSED',
  // A deadline earlier than the person's today, on create, change or reopen.
  'GOAL_DEADLINE_IN_PAST',
  // The day refuses to re-answer a task that is already done.
  'TASK_ALREADY_RESOLVED',
  // A goal step is planned by hand; it cannot become a repeating task.
  'TASK_STEP_CANNOT_REPEAT',
  'INTERNAL_ERROR',
])

export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
})

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>
