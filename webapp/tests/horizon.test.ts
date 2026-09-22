import { expect, test } from 'bun:test'

import { describeHorizon, formatCount, unitForms } from '../src/features/horizon/horizon'

test('counts what is lived and what is ahead from two numbers the person entered', () => {
  const horizon = describeHorizon('2000-01-01', 80, '2040-01-01')

  expect(horizon.livedPercent).toBe(50)
  expect(horizon.remainingYears).toBe(40)
  expect(horizon.livedWeeks).toBeGreaterThan(2000)
  expect(horizon.totalWeeks).toBeGreaterThan(horizon.livedWeeks)
})

test('the day it starts, nothing is lived yet', () => {
  const horizon = describeHorizon('2026-09-22', 80, '2026-09-22')

  expect(horizon.livedWeeks).toBe(0)
  expect(horizon.livedPercent).toBe(0)
  expect(horizon.isPast).toBe(false)
})

test('past the expected age it says so rather than counting backwards', () => {
  const horizon = describeHorizon('1930-01-01', 80, '2026-09-22')

  expect(horizon.isPast).toBe(true)
  expect(horizon.remainingDays).toBe(0)
  expect(horizon.remainingWeeks).toBe(0)
  expect(horizon.livedPercent).toBe(100)
})

test('says the four units the way a person would', () => {
  expect(formatCount(1, unitForms.years)).toBe('1 год')
  expect(formatCount(3, unitForms.years)).toBe('3 года')
  expect(formatCount(11, unitForms.years)).toBe('11 лет')
  expect(formatCount(21, unitForms.days)).toBe('21 день')
  expect(formatCount(2, unitForms.weeks)).toBe('2 недели')
  expect(formatCount(5, unitForms.months)).toBe('5 месяцев')
})
