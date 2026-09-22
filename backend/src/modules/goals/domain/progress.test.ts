import { describe, expect, test } from 'bun:test'

import { automaticProgressValue, daysUntil, goalCompletionRatio } from './progress'

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
  const now = new Date('2026-09-22T21:00:00.000Z')

  test('counts whole days, so a deadline reads the same all day', () => {
    expect(daysUntil(new Date('2026-09-23T01:00:00.000Z'), now)).toBe(1)
    expect(daysUntil(new Date('2026-09-23T23:00:00.000Z'), now)).toBe(1)
    expect(daysUntil(new Date('2026-09-22T01:00:00.000Z'), now)).toBe(0)
  })

  test('goes negative once the deadline has passed', () => {
    expect(daysUntil(new Date('2026-09-20T12:00:00.000Z'), now)).toBe(-2)
  })
})
