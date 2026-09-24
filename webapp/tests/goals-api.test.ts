import { expect, test } from 'bun:test'
import type { GoalDto, GoalTreeResponse } from '@dilife/contracts'

import {
  createGoal,
  deleteGoal,
  fetchGoalTree,
  updateStep,
} from '../src/features/goals/api'

function goal(overrides: Partial<GoalDto> = {}): GoalDto {
  return {
    id: 'goal-1',
    title: 'Пробежать марафон',
    description: null,
    deadline: '2027-05-01',
    measureUnit: 'километров',
    targetValue: 42,
    currentValue: 0,
    progressMode: 'manual',
    status: 'active',
    isPrimary: true,
    outcomeNote: null,
    position: 0,
    completedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    stages: [],
    ...overrides,
  }
}

function recordingTransport(response: unknown) {
  const calls: Array<{ path: string; method?: string; body?: unknown }> = []
  return {
    calls,
    transport: {
      request: async (path: string, schema: { parse(value: unknown): unknown }, options?: {
        method?: string
        body?: unknown
      }) => {
        calls.push({ path, method: options?.method, body: options?.body })
        return schema.parse(response)
      },
    },
  }
}

test('the tree is read from one address, with no owner in the path', async () => {
  const empty: GoalTreeResponse = { lifeGoal: null, goals: [] }
  const { calls, transport } = recordingTransport(empty)

  expect(await fetchGoalTree(transport as never)).toEqual(empty)
  expect(calls).toEqual([{ path: '/api/goals', method: undefined, body: undefined }])
})

test('a new goal is validated before it leaves the browser', async () => {
  const { calls, transport } = recordingTransport({ goal: goal() })

  await createGoal(transport as never, {
    title: '  Пробежать марафон  ',
    deadline: '2027-05-01',
    measureUnit: ' километров ',
    targetValue: 42,
    progressMode: 'manual',
    deadlineWarningDays: 3,
  })

  // Trimmed by the contract, not by the component: every caller gets the same normalisation.
  expect(calls[0]?.body).toEqual({
    title: 'Пробежать марафон',
    deadline: '2027-05-01',
    measureUnit: 'километров',
    targetValue: 42,
    progressMode: 'manual',
    deadlineWarningDays: 3,
  })
})

test('a step is completed through the flag the contract allows', async () => {
  const { calls, transport } = recordingTransport({ goal: goal() })

  await updateStep(transport as never, 'step-1', { isCompleted: true })

  expect(calls[0]).toEqual({
    path: '/api/goals/steps/step-1',
    method: 'PATCH',
    body: { isCompleted: true },
  })
})

test('deleting a goal answers with the tree, because the primary one may have changed', async () => {
  const tree: GoalTreeResponse = {
    lifeGoal: { id: 'life-1', title: 'Быть здоровым', createdAt: '2026-09-01T00:00:00.000Z' },
    goals: [],
  }
  const { calls, transport } = recordingTransport(tree)

  expect(await deleteGoal(transport as never, 'goal-1')).toEqual(tree)
  expect(calls[0]?.method).toBe('DELETE')
})
