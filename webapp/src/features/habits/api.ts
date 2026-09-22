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

/**
 * Every call carries the day the viewer calls today. Streaks depend on it, and only the client
 * knows the person's time zone: taking it from the server clock would break a streak at the
 * wrong hour for anyone living elsewhere.
 */

export function fetchHabits(
  transport: AuthenticatedTransport,
  today: string,
  options?: { signal?: AbortSignal },
) {
  return transport.request(`/api/habits?today=${today}`, habitsResponseSchema, {
    signal: options?.signal,
  })
}

export function createHabit(
  transport: AuthenticatedTransport,
  today: string,
  input: CreateHabitRequest,
) {
  return transport.request(`/api/habits?today=${today}`, habitResponseSchema, {
    method: 'POST',
    body: createHabitRequestSchema.parse(input),
  })
}

export function updateHabit(
  transport: AuthenticatedTransport,
  today: string,
  habitId: string,
  input: UpdateHabitRequest,
) {
  return transport.request(`/api/habits/${habitId}?today=${today}`, habitResponseSchema, {
    method: 'PATCH',
    body: updateHabitRequestSchema.parse(input),
  })
}

export function markHabit(
  transport: AuthenticatedTransport,
  today: string,
  habitId: string,
  input: MarkHabitRequest,
) {
  return transport.request(`/api/habits/${habitId}/marks?today=${today}`, habitResponseSchema, {
    method: 'POST',
    body: markHabitRequestSchema.parse(input),
  })
}

export function deleteHabit(
  transport: AuthenticatedTransport,
  today: string,
  habitId: string,
) {
  return transport.request(`/api/habits/${habitId}?today=${today}`, habitsResponseSchema, {
    method: 'DELETE',
  })
}
