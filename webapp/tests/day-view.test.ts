import { expect, test } from 'bun:test'
import type { TaskDto } from '@dilife/contracts'

import {
  countDay,
  formatDayHeading,
  formatDuration,
  formatMinuteOfDay,
  relativeDayLabel,
  shiftDay,
  taskWord,
  toDayDate,
} from '../src/features/day/day-view'

function task(overrides: Partial<TaskDto> & { id: string }): TaskDto {
  return {
    scheduledOn: '2026-09-22',
    startMinute: 540,
    durationMinutes: 30,
    title: 'Задача',
    description: null,
    priority: 'normal',
    outcome: 'planned',
    completedAt: null,
    movedFrom: null,
    colorOverride: null,
    categoryId: null,
    stepId: null,
    position: 0,
    subtasks: [],
    ...overrides,
  }
}

test('counts what happened in the day, with burned tasks counting against it', () => {
  const counts = countDay([
    task({ id: 'a', outcome: 'done' }),
    task({ id: 'b', outcome: 'burned' }),
    task({ id: 'c', outcome: 'planned' }),
    task({ id: 'd', outcome: 'planned' }),
  ])

  expect(counts).toEqual({
    total: 4,
    done: 1,
    burned: 1,
    unresolved: 2,
    donePercent: 25,
  })
})

test('an empty day reports zero rather than dividing by nothing', () => {
  expect(countDay([]).donePercent).toBe(0)
})

test('says times and lengths the way a person would', () => {
  expect(formatMinuteOfDay(510)).toBe('08:30')
  expect(formatMinuteOfDay(0)).toBe('00:00')
  expect(formatDuration(45)).toBe('45 мин')
  expect(formatDuration(60)).toBe('1 ч')
  expect(formatDuration(95)).toBe('1 ч 35 мин')
})

test('moves between days without dragging a time zone along', () => {
  expect(shiftDay('2026-09-22', 1)).toBe('2026-09-23')
  expect(shiftDay('2026-09-01', -1)).toBe('2026-08-31')
  expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
})

test('today is the day the viewer calls today, in their own zone', () => {
  expect(toDayDate(new Date(2026, 8, 22, 23, 30))).toBe('2026-09-22')
  expect(toDayDate(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
})

test('names the day, and says yesterday, today and tomorrow by name', () => {
  expect(formatDayHeading('2026-09-22')).toBe('22 сентября, вторник')
  expect(relativeDayLabel('2026-09-22', '2026-09-22')).toBe('сегодня')
  expect(relativeDayLabel('2026-09-23', '2026-09-22')).toBe('завтра')
  expect(relativeDayLabel('2026-09-21', '2026-09-22')).toBe('вчера')
  expect(relativeDayLabel('2026-09-30', '2026-09-22')).toBeNull()
})

test('task counts agree in Russian', () => {
  expect([1, 2, 5, 11, 21, 22, 112].map(taskWord)).toEqual([
    'задача',
    'задачи',
    'задач',
    'задач',
    'задача',
    'задачи',
    'задач',
  ])
})
