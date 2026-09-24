import {
  settingsWithClockResponseSchema,
  updateSettingsRequestSchema,
  type UpdateSettingsRequest,
} from '@dilife/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

export function fetchSettings(
  transport: AuthenticatedTransport,
  options?: { signal?: AbortSignal },
) {
  return transport.request('/api/settings', settingsWithClockResponseSchema, {
    signal: options?.signal,
  })
}

export function updateSettings(transport: AuthenticatedTransport, input: UpdateSettingsRequest) {
  return transport.request('/api/settings', settingsWithClockResponseSchema, {
    method: 'PATCH',
    body: updateSettingsRequestSchema.parse(input),
  })
}
