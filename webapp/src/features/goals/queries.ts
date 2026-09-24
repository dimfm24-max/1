import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CloseGoalRequest,
  CreateGoalRequest,
  CreateStageRequest,
  CreateStepRequest,
  GoalDto,
  GoalTreeResponse,
  UpdateGoalRequest,
  UpdateStageRequest,
  UpdateStepRequest,
} from '@dilife/contracts'

import { sessionQueryKeys, useAuth } from '@/features/auth'
import type { AuthenticatedTransport } from '@/platform/api'
import { overdueGoals } from './goal-view'
import {
  closeGoal,
  createGoal,
  createStage,
  createStep,
  deleteGoal,
  deleteLifeGoal,
  deleteStage,
  deleteStep,
  fetchGoalProgressHistory,
  fetchGoalTree,
  recordGoalProgress,
  reopenGoal,
  reorderStages,
  reorderSteps,
  setPrimaryGoal,
  updateGoal,
  updateStage,
  updateStep,
  upsertLifeGoal,
} from './api'

// Session-scoped, like every other feature cache: the tree belongs to whoever is signed in, and
// the QueryClient outlives a sign-out. Keeping the key under `sessionQueryKeys.all` is what makes
// session cleanup drop it instead of showing the next account the previous one's goals.
export const goalQueryKeys = {
  all: [...sessionQueryKeys.all, 'goals'] as const,
  tree: () => [...sessionQueryKeys.all, 'goals', 'tree'] as const,
  history: (goalId: string) => [...sessionQueryKeys.all, 'goals', 'history', goalId] as const,
}

export function goalTreeQueryOptions(transport: AuthenticatedTransport) {
  return queryOptions({
    queryKey: goalQueryKeys.tree(),
    queryFn: ({ signal }) => fetchGoalTree(transport, { signal }),
  })
}

export function useGoalTreeQuery() {
  const auth = useAuth()

  return useQuery(goalTreeQueryOptions(auth.transport))
}

/**
 * Writes answer with the goal they changed, so the cached tree is patched in place rather than
 * refetched. Server-computed values - automatic progress, which goal is primary - travel in that
 * response, so the client never has to derive them.
 */
function useGoalMutation<TVariables>(
  mutationFn: (transport: AuthenticatedTransport, variables: TVariables) => Promise<{
    goal: GoalDto
  }>,
) {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: TVariables) => mutationFn(auth.transport, variables),
    onSuccess: (response) => {
      queryClient.setQueryData<GoalTreeResponse>(goalQueryKeys.tree(), (current) =>
        current ? mergeGoal(current, response.goal) : current,
      )
      // The number may have moved, and a changed goal can change the day and the statistics.
      void queryClient.invalidateQueries({ queryKey: goalQueryKeys.history(response.goal.id) })
      void queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.all,
        predicate: (query) => query.queryKey[1] === 'statistics' || query.queryKey[1] === 'sharing',
      })
    },
  })
}

/**
 * One goal changed, and possibly which goal is primary. Both are read off the response: marking
 * a goal primary demotes another one, and a stale flag would show two.
 */
function mergeGoal(tree: GoalTreeResponse, goal: GoalDto): GoalTreeResponse {
  // Closing the main goal takes the mark away on the server; nothing else changes then.
  const demoteOthers = goal.isPrimary
  const goals = tree.goals.map((existing) => {
    if (existing.id === goal.id) return goal
    return demoteOthers && existing.isPrimary ? { ...existing, isPrimary: false } : existing
  })
  return {
    ...tree,
    goals: goals.some((existing) => existing.id === goal.id) ? goals : [...goals, goal],
  }
}

export function useUpsertLifeGoalMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (title: string) => upsertLifeGoal(auth.transport, title),
    onSuccess: (response) => {
      queryClient.setQueryData<GoalTreeResponse>(goalQueryKeys.tree(), (current) =>
        current ? { ...current, lifeGoal: response.lifeGoal } : current,
      )
    },
  })
}

export function useCreateGoalMutation() {
  return useGoalMutation<CreateGoalRequest>((transport, input) => createGoal(transport, input))
}

export function useUpdateGoalMutation() {
  return useGoalMutation<{ goalId: string; input: UpdateGoalRequest }>(
    (transport, { goalId, input }) => updateGoal(transport, goalId, input),
  )
}

export function useRecordProgressMutation() {
  return useGoalMutation<{ goalId: string; currentValue: number }>(
    (transport, { goalId, currentValue }) =>
      recordGoalProgress(transport, goalId, { currentValue }),
  )
}

export function useCloseGoalMutation() {
  return useGoalMutation<{ goalId: string; input: CloseGoalRequest }>(
    (transport, { goalId, input }) => closeGoal(transport, goalId, input),
  )
}

export function useReopenGoalMutation() {
  return useGoalMutation<{ goalId: string; deadline: string }>(
    (transport, { goalId, deadline }) => reopenGoal(transport, goalId, deadline),
  )
}

export function useSetPrimaryGoalMutation() {
  return useGoalMutation<string>((transport, goalId) => setPrimaryGoal(transport, goalId))
}

export function useCreateStageMutation() {
  return useGoalMutation<{ goalId: string; input: CreateStageRequest }>(
    (transport, { goalId, input }) => createStage(transport, goalId, input),
  )
}

export function useDeleteStageMutation() {
  return useGoalMutation<string>((transport, stageId) => deleteStage(transport, stageId))
}

export function useCreateStepMutation() {
  return useGoalMutation<{ stageId: string; input: CreateStepRequest }>(
    (transport, { stageId, input }) => createStep(transport, stageId, input),
  )
}

export function useUpdateStepMutation() {
  return useGoalMutation<{ stepId: string; input: UpdateStepRequest }>(
    (transport, { stepId, input }) => updateStep(transport, stepId, input),
  )
}

export function useDeleteStepMutation() {
  return useGoalMutation<string>((transport, stepId) => deleteStep(transport, stepId))
}

/** Deleting answers with the whole tree: the goal is gone, and it may have been the primary one. */
export function useDeleteGoalMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (goalId: string) => deleteGoal(auth.transport, goalId),
    onSuccess: (tree) => {
      queryClient.setQueryData<GoalTreeResponse>(goalQueryKeys.tree(), tree)
    },
  })
}

export function useUpdateStageMutation() {
  return useGoalMutation<{ stageId: string; input: UpdateStageRequest }>(
    (transport, { stageId, input }) => updateStage(transport, stageId, input),
  )
}

export function useReorderStagesMutation() {
  return useGoalMutation<{ goalId: string; ids: string[] }>((transport, { goalId, ids }) =>
    reorderStages(transport, goalId, ids),
  )
}

export function useReorderStepsMutation() {
  return useGoalMutation<{ stageId: string; ids: string[] }>((transport, { stageId, ids }) =>
    reorderSteps(transport, stageId, ids),
  )
}

export function useGoalProgressHistoryQuery(goalId: string, enabled: boolean) {
  const auth = useAuth()
  return useQuery({
    queryKey: goalQueryKeys.history(goalId),
    queryFn: ({ signal }) => fetchGoalProgressHistory(auth.transport, goalId, { signal }),
    enabled,
  })
}

/** Deleting the life goal answers with the tree: goals kept without it, or moved to the trash. */
export function useDeleteLifeGoalMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (goals: 'trash' | 'detach') => deleteLifeGoal(auth.transport, goals),
    onSuccess: (tree) => {
      queryClient.setQueryData<GoalTreeResponse>(goalQueryKeys.tree(), tree)
    },
  })
}

/** Open goals past their deadline; the review screen asks about each (task 09). */
export function useOverdueGoals(today: string): GoalDto[] {
  const tree = useGoalTreeQuery()
  return tree.data ? overdueGoals(tree.data.goals, today) : []
}
