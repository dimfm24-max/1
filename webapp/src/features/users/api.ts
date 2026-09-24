import {
  updateProfileRequestSchema,
  updateProfileResponseSchema,
  type UpdateProfileRequest,
} from '@dilife/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

export function updateProfile(
  transport: AuthenticatedTransport,
  input: UpdateProfileRequest,
) {
  return transport.request(
    '/api/users/me',
    updateProfileResponseSchema,
    {
      method: 'PATCH',
      body: updateProfileRequestSchema.parse(input),
    },
  )
}

/** The first-run wizard is done (task 07). */
export function completeOnboarding(transport: AuthenticatedTransport) {
  return transport.request('/api/users/me/onboarding', updateProfileResponseSchema, {
    method: 'POST',
  })
}
