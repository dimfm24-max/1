import { expect, test } from 'bun:test'
import type { TaskDto } from '@dilife/contracts'

import {
  fullScale,
  layoutBlocks,
  movedStart,
  nowOffset,
  snapMinutes,
  startAtOffset,
  stretchedDuration,
} from '../src/features/day/timeline'

function task(id: string, startMinute: number | null, durationMinutes = 30, position = 0): TaskDto {
  return {
    id,
    scheduledOn: '2026-10-01',
    startMinute,
    durationMinutes,
    title: id,
    description: null,
    priority: 'normal',
    outcome: 'planned',
    completedAt: null,
    movedFrom: null,
    colorOverride: null,
    categoryId: null,
    stepId: null,
    position,
    subtasks: [],
  }
}

test('a block stands at its time and is as tall as its duration', () => {
  const [block] = layoutBlocks([task('a', 600, 60)], 0, fullScale)
  expect(block!.top).toBe(600 * fullScale.pxPerMinute)
  expect(block!.height).toBe(60 * fullScale.pxPerMinute)
  expect(block!.lanes).toBe(1)
})

test('a short task keeps a finger-sized block', () => {
  const [block] = layoutBlocks([task('a', 600, 15)], 0, fullScale)
  expect(block!.height).toBe(fullScale.minBlockPx)
})

test('two tasks at the same time stand side by side and are marked', () => {
  const blocks = layoutBlocks([task('a', 600, 60), task('b', 630, 30), task('c', 900)], 0, fullScale)
  const byId = Object.fromEntries(blocks.map((block) => [block.task.id, block]))
  expect(byId.a!.lanes).toBe(2)
  expect(new Set([byId.a!.lane, byId.b!.lane])).toEqual(new Set([0, 1]))
  expect(byId.a!.overlaps && byId.b!.overlaps).toBe(true)
  expect(byId.c!.lanes).toBe(1)
  expect(byId.c!.overlaps).toBe(false)
})

test('with a 04:00 day start 01:00 is at the end, and it overlaps 23:30 for two hours', () => {
  const blocks = layoutBlocks([task('late', 23 * 60 + 30, 120), task('night', 60)], 240, fullScale)
  const night = blocks.find((block) => block.task.id === 'night')!
  const late = blocks.find((block) => block.task.id === 'late')!
  expect(night.offset).toBe(21 * 60)
  expect(night.top).toBeGreaterThan(late.top)
  expect(night.overlaps && late.overlaps).toBe(true)
})

test('tasks without a time are not on the timeline', () => {
  expect(layoutBlocks([task('free', null)], 0, fullScale)).toEqual([])
})

test('drags snap to 15 minutes and stay inside the day', () => {
  expect(snapMinutes(fullScale.pxPerMinute * 50, fullScale)).toBe(45)
  expect(movedStart(600, 30, 90, 0)).toBe(690)
  // 01:00 two hours back is 23:00 of the same day when the day starts at 04:00.
  expect(movedStart(60, 30, -120, 240)).toBe(1380)
  expect(movedStart(1400, 60, 120, 0)).toBe(1380)
  expect(startAtOffset(fullScale.pxPerMinute * 610, 0, fullScale)).toBe(615)
  expect(startAtOffset(0, 240, fullScale)).toBe(240)
})

test('stretching changes the length in grid steps, never below one step', () => {
  expect(stretchedDuration(600, 30, 30, 0)).toBe(60)
  expect(stretchedDuration(600, 30, -60, 0)).toBe(15)
  expect(stretchedDuration(1380, 30, 120, 0)).toBe(60)
})

test('the now line follows the day start', () => {
  expect(nowOffset(150, 240, fullScale)).toBe((150 + 1440 - 240) * fullScale.pxPerMinute)
})
