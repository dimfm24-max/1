import { expect, test } from 'bun:test'

import { emptyGoalDraft, parseGoalDraft } from '../src/features/goals/goal-draft'

const today = '2026-09-22'

function draft(overrides: Record<string, string> = {}) {
  return {
    ...emptyGoalDraft(),
    title: 'Пробежать марафон',
    deadline: '2026-12-01',
    measureUnit: 'километров',
    targetValue: '42',
    ...overrides,
  }
}

test('a complete draft reads as numbers, counted from steps by default', () => {
  const parsed = parseGoalDraft(draft({ targetValue: '42,5' }), today)
  expect(parsed).toEqual({
    goal: {
      title: 'Пробежать марафон',
      description: null,
      deadline: '2026-12-01',
      measureUnit: 'километров',
      progressMode: 'automatic',
      initialValue: null,
      targetValue: 42.5,
      deadlineWarningDays: 3,
    },
  })
})

test('names each missing or wrong field before anything is sent', () => {
  const parsed = parseGoalDraft(
    draft({ title: ' ', deadline: '2026-09-01', measureUnit: '', targetValue: 'много' }),
    today,
  )
  expect('errors' in parsed && Object.keys(parsed.errors).sort()).toEqual([
    'deadline',
    'measureUnit',
    'targetValue',
    'title',
  ])
})

test('an old deadline left as it was does not block an edit', () => {
  expect('goal' in parseGoalDraft(draft({ deadline: '2026-09-01' }), today, {
    deadlineUnchanged: '2026-09-01',
  })).toBe(true)
})

test('a manual goal cannot aim at the number it starts from', () => {
  const parsed = parseGoalDraft(
    draft({ progressMode: 'manual', initialValue: '60', targetValue: '60' }),
    today,
  )
  expect('errors' in parsed && parsed.errors.targetValue).toBeTruthy()
  const falling = parseGoalDraft(
    draft({ progressMode: 'manual', initialValue: '80', targetValue: '60' }),
    today,
  )
  expect('goal' in falling && falling.goal.initialValue).toBe(80)
})
