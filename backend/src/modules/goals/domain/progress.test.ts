import { describe, expect, test } from 'bun:test'

import { automaticProgressValue, daysUntil, goalCompletionRatio, goalRatio } from './progress'

describe('goalCompletionRatio', () => {
  test('reports the share of the target that is reached', () => {
    expect(goalCompletionRatio({ currentValue: 21, targetValue: 42 })).toBe(0.5)
    expect(goalCompletionRatio({ currentValue: 0, targetValue: 42 })).toBe(0)
  })

  test('stops at full when the person overshoots', () => {
    expect(goalCompletionRatio({ currentValue: 45, targetValue: 42 })).toBe(1)
  })

  test('treats a target of zero as nothing to reach instead of dividing', () => {
    expect(goalCompletionRatio({ currentValue: 5, targetValue: 0 })).toBe(0)
    expect(goalCompletionRatio({ currentValue: 0, targetValue: 0 })).toBe(0)
  })
})

describe('automaticProgressValue', () => {
  test('counts steps, not their estimates', () => {
    expect(automaticProgressValue({ completedSteps: 3, totalSteps: 4, targetValue: 100 })).toBe(75)
  })

  test('a tree with no steps has not moved', () => {
    expect(automaticProgressValue({ completedSteps: 0, totalSteps: 0, targetValue: 100 })).toBe(0)
  })

  test('rounds to the three decimals the column stores', () => {
    expect(automaticProgressValue({ completedSteps: 1, totalSteps: 3, targetValue: 10 }))
      .toBe(3.333)
  })
})

describe('daysUntil', () => {
  test('counts whole calendar days, so a deadline reads the same all day', () => {
    expect(daysUntil('2026-09-23', '2026-09-22')).toBe(1)
    expect(daysUntil('2026-09-22', '2026-09-22')).toBe(0)
  })

  test('goes negative once the deadline has passed', () => {
    expect(daysUntil('2026-09-20', '2026-09-22')).toBe(-2)
  })
})

test('a goal with a start runs from it towards the target, down as well as up', () => {
  const weight = { targetValue: 60, initialValue: 80 }
  expect(goalCompletionRatio({ ...weight, currentValue: 80 })).toBe(0)
  expect(goalCompletionRatio({ ...weight, currentValue: 70 })).toBe(0.5)
  expect(goalCompletionRatio({ ...weight, currentValue: 60 })).toBe(1)
  // Moving away from the target is not negative progress on the bar, and passing it stops at 1.
  expect(goalCompletionRatio({ ...weight, currentValue: 85 })).toBe(0)
  expect(goalCompletionRatio({ ...weight, currentValue: 55 })).toBe(1)
  expect(goalCompletionRatio({ targetValue: 20, initialValue: 10, currentValue: 15 })).toBe(0.5)
})

test('an automatic goal ignores a stored start', () => {
  expect(
    goalRatio({ progressMode: 'automatic', currentValue: 21, targetValue: 42, initialValue: 40 }),
  ).toBe(0.5)
})
