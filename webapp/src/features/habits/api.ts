import {
  createHabitRequestSchema,
  habitResponseSchema,
  habitsResponseSchema,
  markHabitRequestSchema,
  updateHabitRequestSchema,
  type CreateHabitRequest,
  type MarkHabitRequest,
  type UpdateHabitRequest,
} from '@dilife/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

export function fetchHabits(
  transport: AuthenticatedTransport,
  options?: { signal?: AbortSignal },
) {
  return transport.request(`/api/habits`, habitsResponseSchema, {
    signal: options?.signal,
  })
}

export function createHabit(
  transport: AuthenticatedTransport,
  input: CreateHabitRequest,
) {
  return transport.request(`/api/habits`, habitResponseSchema, {
    method: 'POST',
    body: createHabitRequestSchema.parse(input),
  })
}

export function updateHabit(
  transport: AuthenticatedTransport,
  habitId: string,
  input: UpdateHabitRequest,
) {
  return transport.request(`/api/habits/${habitId}`, habitResponseSchema, {
    method: 'PATCH',
    body: updateHabitRequestSchema.parse(input),
  })
}

export function markHabit(
  transport: AuthenticatedTransport,
  habitId: string,
  input: MarkHabitRequest,
) {
  return transport.request(`/api/habits/${habitId}/marks`, habitResponseSchema, {
    method: 'POST',
    body: markHabitRequestSchema.parse(input),
  })
}

export function deleteHabit(
  transport: AuthenticatedTransport,
  habitId: string,
) {
  return transport.request(`/api/habits/${habitId}`, habitsResponseSchema, {
    method: 'DELETE',
  })
}
