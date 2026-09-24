import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateHabitRequest, HabitDto, HabitsResponse, UpdateHabitRequest } from '@dilife/contracts'

import { sessionQueryKeys, useAuth } from '@/features/auth'
import type { AuthenticatedTransport } from '@/platform/api'
import { createHabit, deleteHabit, fetchHabits, markHabit, updateHabit } from './api'

export const habitQueryKeys = {
  // Keyed by the person's today so an open tab refetches when a new day starts; the server
  // works the day out itself and is not told it.
  list: (today: string) => [...sessionQueryKeys.all, 'habits', today] as const,
}

export function habitsQueryOptions(transport: AuthenticatedTransport, today: string) {
  return queryOptions({
    queryKey: habitQueryKeys.list(today),
    queryFn: ({ signal }) => fetchHabits(transport, { signal }),
  })
}

export function useHabitsQuery(today: string) {
  const auth = useAuth()

  return useQuery(habitsQueryOptions(auth.transport, today))
}

/** Writes answer with the habit, streaks already recomputed, so the cache is replaced from it. */
function useHabitMutation<TVariables>(
  today: string,
  mutationFn: (
    transport: AuthenticatedTransport,
    variables: TVariables,
  ) => Promise<{ habit: HabitDto }>,
) {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: TVariables) => mutationFn(auth.transport, variables),
    onSuccess: (response) => {
      queryClient.setQueryData<HabitsResponse>(habitQueryKeys.list(today), (current) => {
        if (!current) return current
        const known = current.habits.some((habit) => habit.id === response.habit.id)
        return {
          habits: known
            ? current.habits.map((habit) =>
                habit.id === response.habit.id ? response.habit : habit,
              )
            : [...current.habits, response.habit],
        }
      })
    },
  })
}

export function useCreateHabitMutation(today: string) {
  return useHabitMutation<CreateHabitRequest>(today, (transport, input) =>
    createHabit(transport, input),
  )
}

export function useUpdateHabitMutation(today: string) {
  return useHabitMutation<{ habitId: string; input: UpdateHabitRequest }>(
    today,
    (transport, { habitId, input }) => updateHabit(transport, habitId, input),
  )
}

export function useMarkHabitMutation(today: string) {
  return useHabitMutation<{ habitId: string; markedOn: string; isDone: boolean }>(
    today,
    (transport, { habitId, markedOn, isDone }) =>
      markHabit(transport, habitId, { markedOn, isDone }),
  )
}

export function useDeleteHabitMutation(today: string) {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (habitId: string) => deleteHabit(auth.transport, habitId),
    onSuccess: (response) => {
      queryClient.setQueryData<HabitsResponse>(habitQueryKeys.list(today), response)
    },
  })
}
