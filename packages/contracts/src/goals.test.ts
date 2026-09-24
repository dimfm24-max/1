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
  deadline: '2027-05-01',
  measureUnit: ' километров ',
  targetValue: 42,
}

describe('goal contracts', () => {
  test('trims a new goal and counts it from its steps by default', () => {
    expect(createGoalRequestSchema.parse(validGoal)).toEqual({
      title: 'Пробежать марафон',
      deadline: '2027-05-01',
      measureUnit: 'километров',
      targetValue: 42,
      progressMode: 'automatic',
      deadlineWarningDays: 3,
    })
  })

  test('a target must differ from the start, and be above zero without one', () => {
    expect(() =>
      createGoalRequestSchema.parse({ ...validGoal, targetValue: 0 }),
    ).toThrow()
    expect(() =>
      createGoalRequestSchema.parse({
        ...validGoal,
        progressMode: 'manual',
        targetValue: 60,
        initialValue: 60,
      }),
    ).toThrow()
    expect(
      createGoalRequestSchema.parse({
        ...validGoal,
        progressMode: 'manual',
        targetValue: 60,
        initialValue: 80,
      }).initialValue,
    ).toBe(80)
    // An automatic goal counts steps, so a start of its own does not matter.
    expect(
      createGoalRequestSchema.parse({ ...validGoal, targetValue: 42, initialValue: 42 })
        .targetValue,
    ).toBe(42)
  })

  test('takes the date part of a moment sent by a client from before deadlines were dates', () => {
    expect(
      createGoalRequestSchema.parse({ ...validGoal, deadline: '2027-05-01T23:59:59.000Z' }).deadline,
    ).toBe('2027-05-01')
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

  test('closing a goal accepts only the two endings, and always with an outcome', () => {
    expect(() => closeGoalRequestSchema.parse({ status: 'completed' })).toThrow()
    expect(() => closeGoalRequestSchema.parse({ status: 'completed', outcomeNote: '  ' })).toThrow()
    expect(closeGoalRequestSchema.parse({ status: 'abandoned', outcomeNote: ' Понял, что не моё ' }))
      .toEqual({ status: 'abandoned', outcomeNote: 'Понял, что не моё' })
    expect(() =>
      closeGoalRequestSchema.parse({ status: 'active', outcomeNote: 'Итог' }),
    ).toThrow()
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
