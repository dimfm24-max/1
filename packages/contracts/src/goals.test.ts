import { describe, expect, test } from 'bun:test'

import {
  closeGoalRequestSchema,
  createGoalRequestSchema,
  createStepRequestSchema,
  GOAL_TITLE_MAX,
  goalTreeResponseSchema,
  recordGoalProgressRequestSchema,
  updateStepRequestSchema,
} from './index'

const validGoal = {
  title: '  Пробежать марафон  ',
  deadline: '2027-05-01T00:00:00.000Z',
  measureUnit: ' километров ',
  targetValue: 42,
}

describe('goal contracts', () => {
  test('trims a new goal and defaults progress to the value the person records', () => {
    expect(createGoalRequestSchema.parse(validGoal)).toEqual({
      title: 'Пробежать марафон',
      deadline: '2027-05-01T00:00:00.000Z',
      measureUnit: 'километров',
      targetValue: 42,
      progressMode: 'manual',
    })
  })

  test('refuses a goal without a deadline, because every goal carries one', () => {
    const { deadline: _deadline, ...withoutDeadline } = validGoal
    expect(() => createGoalRequestSchema.parse(withoutDeadline)).toThrow()
    expect(() => createGoalRequestSchema.parse({ ...validGoal, deadline: 'next May' })).toThrow()
  })

  test('bounds the title and the measure unit', () => {
    expect(() =>
      createGoalRequestSchema.parse({ ...validGoal, title: 'x'.repeat(GOAL_TITLE_MAX + 1) }),
    ).toThrow()
    expect(() => createGoalRequestSchema.parse({ ...validGoal, title: '   ' })).toThrow()
    expect(() => createGoalRequestSchema.parse({ ...validGoal, measureUnit: '' })).toThrow()
  })

  test('keeps unknown fields out, so a client cannot smuggle owner or status', () => {
    expect(() =>
      createGoalRequestSchema.parse({ ...validGoal, userId: 'someone-else' }),
    ).toThrow()
    expect(() => createGoalRequestSchema.parse({ ...validGoal, status: 'completed' })).toThrow()
  })

  test('progress is a non-negative number', () => {
    expect(recordGoalProgressRequestSchema.parse({ currentValue: 12.5 })).toEqual({
      currentValue: 12.5,
    })
    expect(() => recordGoalProgressRequestSchema.parse({ currentValue: -1 })).toThrow()
    expect(() => recordGoalProgressRequestSchema.parse({ currentValue: Number.NaN })).toThrow()
  })

  test('closing a goal accepts only the two endings, with an optional note', () => {
    expect(closeGoalRequestSchema.parse({ status: 'completed' })).toEqual({ status: 'completed' })
    expect(closeGoalRequestSchema.parse({ status: 'abandoned', outcomeNote: ' Понял, что не моё ' }))
      .toEqual({ status: 'abandoned', outcomeNote: 'Понял, что не моё' })
    expect(() => closeGoalRequestSchema.parse({ status: 'active' })).toThrow()
  })

  test('a step may estimate its time, but never a whole day or a negative one', () => {
    expect(createStepRequestSchema.parse({ title: 'Купить кроссовки' })).toEqual({
      title: 'Купить кроссовки',
    })
    expect(createStepRequestSchema.parse({ title: 'Пробежка', estimatedMinutes: 45 }))
      .toEqual({ title: 'Пробежка', estimatedMinutes: 45 })
    expect(() => createStepRequestSchema.parse({ title: 'Пробежка', estimatedMinutes: 0 })).toThrow()
    expect(() =>
      createStepRequestSchema.parse({ title: 'Пробежка', estimatedMinutes: 24 * 60 + 1 }),
    ).toThrow()
  })

  test('a step is completed through a flag, not by writing a timestamp', () => {
    expect(updateStepRequestSchema.parse({ isCompleted: true })).toEqual({ isCompleted: true })
    expect(() =>
      updateStepRequestSchema.parse({ completedAt: '2026-09-22T00:00:00.000Z' }),
    ).toThrow()
  })

  test('the tree reads with no life goal yet, which is how a new account starts', () => {
    expect(goalTreeResponseSchema.parse({ lifeGoal: null, goals: [] })).toEqual({
      lifeGoal: null,
      goals: [],
    })
  })
})
