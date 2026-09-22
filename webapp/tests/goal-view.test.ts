import { expect, test } from 'bun:test'

import { describeGoal, formatDaysLeft } from '../src/features/goals/goal-view'

const now = new Date('2026-09-22T21:00:00.000Z')

function goal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'goal-1',
    title: 'Пробежать марафон',
    description: null,
    deadline: '2026-09-30T00:00:00.000Z',
    measureUnit: 'километров',
    targetValue: 42,
    currentValue: 21,
    progressMode: 'manual' as const,
    status: 'active' as const,
    isPrimary: true,
    outcomeNote: null,
    position: 0,
    completedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    stages: [],
    ...overrides,
  }
}

test('reports progress as a percentage of the target', () => {
  expect(describeGoal(goal(), now).completionPercent).toBe(50)
  expect(describeGoal(goal({ currentValue: 45 }), now).completionPercent).toBe(100)
  expect(describeGoal(goal({ targetValue: 0 }), now).completionPercent).toBe(0)
})

test('counts the steps across every stage', () => {
  const view = describeGoal(
    goal({
      stages: [
        {
          id: 'stage-1',
          title: 'Подготовка',
          position: 0,
          steps: [
            { id: 's1', title: 'Шаг', estimatedMinutes: null, completedAt: '2026-09-10T00:00:00.000Z', position: 0 },
            { id: 's2', title: 'Шаг', estimatedMinutes: null, completedAt: null, position: 1 },
          ],
        },
        {
          id: 'stage-2',
          title: 'Забег',
          position: 1,
          steps: [
            { id: 's3', title: 'Шаг', estimatedMinutes: null, completedAt: null, position: 0 },
          ],
        },
      ],
    }),
    now,
  )

  expect(view.completedSteps).toBe(1)
  expect(view.totalSteps).toBe(3)
})

test('counts whole days, so a deadline reads the same all day', () => {
  expect(describeGoal(goal({ deadline: '2026-09-23T01:00:00.000Z' }), now).daysLeft).toBe(1)
  expect(describeGoal(goal({ deadline: '2026-09-22T01:00:00.000Z' }), now).daysLeft).toBe(0)
})

test('a closed goal is never overdue, however late it ended', () => {
  const late = { deadline: '2026-09-01T00:00:00.000Z' }
  expect(describeGoal(goal(late), now).isOverdue).toBe(true)
  expect(describeGoal(goal({ ...late, status: 'completed' }), now).isOverdue).toBe(false)
  expect(describeGoal(goal({ ...late, status: 'abandoned' }), now).isOverdue).toBe(false)
})

test('says the remaining days the way a person would', () => {
  expect(formatDaysLeft(1)).toBe('осталось 1 день')
  expect(formatDaysLeft(3)).toBe('осталось 3 дня')
  expect(formatDaysLeft(5)).toBe('осталось 5 дней')
  expect(formatDaysLeft(11)).toBe('осталось 11 дней')
  expect(formatDaysLeft(21)).toBe('осталось 21 день')
  expect(formatDaysLeft(0)).toBe('последний день')
  expect(formatDaysLeft(-2)).toBe('просрочено на 2 дня')
})
