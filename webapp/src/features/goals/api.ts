import {
  closeGoalRequestSchema,
  createGoalRequestSchema,
  createStageRequestSchema,
  createStepRequestSchema,
  goalResponseSchema,
  goalTreeResponseSchema,
  lifeGoalResponseSchema,
  recordGoalProgressRequestSchema,
  updateGoalRequestSchema,
  updateStageRequestSchema,
  updateStepRequestSchema,
  upsertLifeGoalRequestSchema,
  type CloseGoalRequest,
  type CreateGoalRequest,
  type CreateStageRequest,
  type CreateStepRequest,
  type RecordGoalProgressRequest,
  type UpdateGoalRequest,
  type UpdateStageRequest,
  type UpdateStepRequest,
} from '@dilife/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

/**
 * Every write answers with the whole goal, so the cache is replaced from the response rather
 * than patched. A step edit can move the goal's progress, and reconstructing that on the client
 * would mean keeping the automatic-progress rule in two places.
 */

export function fetchGoalTree(
  transport: AuthenticatedTransport,
  options?: { signal?: AbortSignal },
) {
  return transport.request('/api/goals', goalTreeResponseSchema, { signal: options?.signal })
}

export function upsertLifeGoal(transport: AuthenticatedTransport, title: string) {
  return transport.request('/api/goals/life-goal', lifeGoalResponseSchema, {
    method: 'PUT',
    body: upsertLifeGoalRequestSchema.parse({ title }),
  })
}

export function createGoal(transport: AuthenticatedTransport, input: CreateGoalRequest) {
  return transport.request('/api/goals/goals', goalResponseSchema, {
    method: 'POST',
    body: createGoalRequestSchema.parse(input),
  })
}

export function updateGoal(
  transport: AuthenticatedTransport,
  goalId: string,
  input: UpdateGoalRequest,
) {
  return transport.request(`/api/goals/goals/${goalId}`, goalResponseSchema, {
    method: 'PATCH',
    body: updateGoalRequestSchema.parse(input),
  })
}

export function recordGoalProgress(
  transport: AuthenticatedTransport,
  goalId: string,
  input: RecordGoalProgressRequest,
) {
  return transport.request(`/api/goals/goals/${goalId}/progress`, goalResponseSchema, {
    method: 'POST',
    body: recordGoalProgressRequestSchema.parse(input),
  })
}

export function closeGoal(
  transport: AuthenticatedTransport,
  goalId: string,
  input: CloseGoalRequest,
) {
  return transport.request(`/api/goals/goals/${goalId}/close`, goalResponseSchema, {
    method: 'POST',
    body: closeGoalRequestSchema.parse(input),
  })
}

export function reopenGoal(
  transport: AuthenticatedTransport,
  goalId: string,
  deadline: string,
) {
  return transport.request(`/api/goals/goals/${goalId}/reopen`, goalResponseSchema, {
    method: 'POST',
    body: { deadline },
  })
}

export function setPrimaryGoal(transport: AuthenticatedTransport, goalId: string) {
  return transport.request(`/api/goals/goals/${goalId}/primary`, goalResponseSchema, {
    method: 'POST',
  })
}

export function deleteGoal(transport: AuthenticatedTransport, goalId: string) {
  return transport.request(`/api/goals/goals/${goalId}`, goalTreeResponseSchema, {
    method: 'DELETE',
  })
}

export function createStage(
  transport: AuthenticatedTransport,
  goalId: string,
  input: CreateStageRequest,
) {
  return transport.request(`/api/goals/goals/${goalId}/stages`, goalResponseSchema, {
    method: 'POST',
    body: createStageRequestSchema.parse(input),
  })
}

export function updateStage(
  transport: AuthenticatedTransport,
  stageId: string,
  input: UpdateStageRequest,
) {
  return transport.request(`/api/goals/stages/${stageId}`, goalResponseSchema, {
    method: 'PATCH',
    body: updateStageRequestSchema.parse(input),
  })
}

export function deleteStage(transport: AuthenticatedTransport, stageId: string) {
  return transport.request(`/api/goals/stages/${stageId}`, goalResponseSchema, {
    method: 'DELETE',
  })
}

export function createStep(
  transport: AuthenticatedTransport,
  stageId: string,
  input: CreateStepRequest,
) {
  return transport.request(`/api/goals/stages/${stageId}/steps`, goalResponseSchema, {
    method: 'POST',
    body: createStepRequestSchema.parse(input),
  })
}

export function updateStep(
  transport: AuthenticatedTransport,
  stepId: string,
  input: UpdateStepRequest,
) {
  return transport.request(`/api/goals/steps/${stepId}`, goalResponseSchema, {
    method: 'PATCH',
    body: updateStepRequestSchema.parse(input),
  })
}

export function deleteStep(transport: AuthenticatedTransport, stepId: string) {
  return transport.request(`/api/goals/steps/${stepId}`, goalResponseSchema, { method: 'DELETE' })
}
