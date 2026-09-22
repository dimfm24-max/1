import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CloseGoalRequest,
  CreateGoalRequest,
  CreateStageRequest,
  CreateStepRequest,
  GoalDto,
  GoalTreeResponse,
  UpdateGoalRequest,
  UpdateStepRequest,
} from '@dilife/contracts'

import { sessionQueryKeys, useAuth } from '@/features/auth'
import type { AuthenticatedTransport } from '@/platform/api'
import {
  closeGoal,
  createGoal,
  createStage,
  createStep,
  deleteGoal,
  deleteStage,
  deleteStep,
  fetchGoalTree,
  recordGoalProgress,
  reopenGoal,
  setPrimaryGoal,
  updateGoal,
  updateStep,
  upsertLifeGoal,
} from './api'

// Session-scoped, like every other feature cache: the tree belongs to whoever is signed in, and
// the QueryClient outlives a sign-out. Keeping the key under `sessionQueryKeys.all` is what makes
// session cleanup drop it instead of showing the next account the previous one's goals.
export const goalQueryKeys = {
  tree: () => [...sessionQueryKeys.all, 'goals', 'tree'] as const,
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
    },
  })
}

/**
 * One goal changed, and possibly which goal is primary. Both are read off the response: marking
 * a goal primary demotes another one, and a stale flag would show two.
 */
function mergeGoal(tree: GoalTreeResponse, goal: GoalDto): GoalTreeResponse {
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
