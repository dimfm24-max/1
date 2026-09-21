import { z } from 'zod'

import { userSchema } from './auth'

export const updateProfileRequestSchema = z
  .object({
    displayName: z.union([z.string().trim().min(2).max(80), z.null()]),
  })
  .strict()

export const updateProfileResponseSchema = z
  .object({
    user: userSchema,
  })
  .strict()

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>
export type UpdateProfileResponse = z.infer<typeof updateProfileResponseSchema>
