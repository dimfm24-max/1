import { expect, test } from 'bun:test'

import {
  dayWord,
  describeGoal,
  formatDaysLeft,
  formatDeadline,
  pickMainGoal,
} from '../src/features/goals/goal-view'

// The person's own day, as the settings module works it out.
const today = '2026-09-22'

function goal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'goal-1',
    title: 'Пробежать марафон',
    description: null,
    deadline: '2026-09-30',
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
  expect(describeGoal(goal(), today).completionPercent).toBe(50)
  expect(describeGoal(goal({ currentValue: 45 }), today).completionPercent).toBe(100)
  expect(describeGoal(goal({ targetValue: 0 }), today).completionPercent).toBe(0)
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
    today,
  )

  expect(view.completedSteps).toBe(1)
  expect(view.totalSteps).toBe(3)
})

test('counts whole days, so a deadline reads the same all day', () => {
  expect(describeGoal(goal({ deadline: '2026-09-23' }), today).daysLeft).toBe(1)
  expect(describeGoal(goal({ deadline: '2026-09-22' }), today).daysLeft).toBe(0)
})

test('a closed goal is never overdue, however late it ended', () => {
  const late = { deadline: '2026-09-01' }
  expect(describeGoal(goal(late), today).isOverdue).toBe(true)
  expect(describeGoal(goal({ ...late, status: 'completed' }), today).isOverdue).toBe(false)
  expect(describeGoal(goal({ ...late, status: 'abandoned' }), today).isOverdue).toBe(false)
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

test('the main goal is the open one marked main, else the first open one', () => {
  const closedMain = goal({ id: 'closed', status: 'completed' as const, isPrimary: true })
  const first = goal({ id: 'first', isPrimary: false })
  const marked = goal({ id: 'marked', isPrimary: true })

  expect(pickMainGoal([first, marked])?.id).toBe('marked')
  expect(pickMainGoal([closedMain, first])?.id).toBe('first')
  expect(pickMainGoal([closedMain])).toBeNull()
  expect(pickMainGoal([])).toBeNull()
})

test('a deadline reads as its calendar day', () => {
  expect(formatDeadline('2026-12-31')).toBe('31.12.2026')
  expect(formatDeadline('2026-03-05')).toBe('05.03.2026')
})

test('the day word agrees with the count', () => {
  expect([0, 1, 2, 4, 5, 11, 14, 21, 100, 101].map(dayWord)).toEqual([
    'дней',
    'день',
    'дня',
    'дня',
    'дней',
    'дней',
    'дней',
    'день',
    'дней',
    'день',
  ])
})

test('reads the share the server sent, and shows a goal with a start as a move towards it', () => {
  const weight = goal({
    measureUnit: 'килограммов',
    targetValue: 60,
    currentValue: 70,
    initialValue: 80,
    progressRatio: 0.5,
  })
  const view = describeGoal(weight, today)
  expect(view.completionPercent).toBe(50)
  expect(view.measureLine).toBe('70 → 60 килограммов')
  expect(describeGoal(goal(), today).measureLine).toBe('21 из 42 километров')
})

test('warns a goal-set number of days before the deadline, then on the last day, then overdue', () => {
  const state = (deadline: string, deadlineWarningDays = 3) =>
    describeGoal(goal({ deadline, deadlineWarningDays }), today).deadlineState
  expect(state('2026-09-30')).toBe('on-track')
  expect(state('2026-09-25')).toBe('warning')
  expect(state('2026-09-30', 10)).toBe('warning')
  expect(state('2026-09-22')).toBe('last-day')
  expect(state('2026-09-21')).toBe('overdue')
  expect(describeGoal(goal({ deadline: '2026-09-21', status: 'completed' }), today).deadlineState).toBe(
    'closed',
  )
})
