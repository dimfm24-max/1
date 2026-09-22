import { describe, expect, test } from 'bun:test'

import { findOverlaps, suggestStartMinute, summariseDay, type ScheduledTask } from './schedule'

function task(overrides: Partial<ScheduledTask> & { id: string }): ScheduledTask {
  return {
    startMinute: 540,
    durationMinutes: 30,
    outcome: 'planned',
    ...overrides,
  }
}

describe('findOverlaps', () => {
  test('reports tasks whose times cross', () => {
    const overlaps = findOverlaps([
      task({ id: 'a', startMinute: 540, durationMinutes: 60 }),
      task({ id: 'b', startMinute: 570, durationMinutes: 30 }),
    ])

    expect(overlaps).toEqual([{ first: 'a', second: 'b' }])
  })

  test('touching is not overlapping: one ends where the next begins', () => {
    expect(
      findOverlaps([
        task({ id: 'a', startMinute: 540, durationMinutes: 30 }),
        task({ id: 'b', startMinute: 570, durationMinutes: 30 }),
      ]),
    ).toEqual([])
  })

  test('a task with no time belongs to the day, not to a slot, so it collides with nothing', () => {
    expect(
      findOverlaps([
        task({ id: 'a', startMinute: null, durationMinutes: 600 }),
        task({ id: 'b', startMinute: 540, durationMinutes: 60 }),
      ]),
    ).toEqual([])
  })

  test('reports every crossing pair, not just the first', () => {
    const overlaps = findOverlaps([
      task({ id: 'a', startMinute: 540, durationMinutes: 120 }),
      task({ id: 'b', startMinute: 560, durationMinutes: 30 }),
      task({ id: 'c', startMinute: 580, durationMinutes: 30 }),
    ])

    expect(overlaps).toEqual([
      { first: 'a', second: 'b' },
      { first: 'a', second: 'c' },
      { first: 'b', second: 'c' },
    ])
  })
})

describe('summariseDay', () => {
  test('counts what happened and what is still open', () => {
    const summary = summariseDay([
      task({ id: 'a', outcome: 'done', durationMinutes: 60 }),
      task({ id: 'b', outcome: 'burned', durationMinutes: 30 }),
      task({ id: 'c', outcome: 'planned', durationMinutes: 45 }),
      task({ id: 'd', outcome: 'planned', durationMinutes: 15 }),
    ])

    expect(summary).toEqual({
      planned: 2,
      done: 1,
      burned: 1,
      unresolved: 2,
      plannedMinutes: 150,
      doneMinutes: 60,
    })
  })

  test('an empty day is empty, not undefined', () => {
    expect(summariseDay([])).toEqual({
      planned: 0,
      done: 0,
      burned: 0,
      unresolved: 0,
      plannedMinutes: 0,
      doneMinutes: 0,
    })
  })
})

describe('suggestStartMinute', () => {
  test('starts the day where the person says it starts', () => {
    expect(suggestStartMinute([], 360)).toBe(360)
  })

  test('follows the last timed task, rounded to the next quarter hour', () => {
    expect(
      suggestStartMinute([task({ id: 'a', startMinute: 540, durationMinutes: 50 })], 0),
    ).toBe(600)
  })

  test('ignores tasks with no time when looking for the end of the plan', () => {
    expect(
      suggestStartMinute(
        [
          task({ id: 'a', startMinute: null, durationMinutes: 600 }),
          task({ id: 'b', startMinute: 540, durationMinutes: 30 }),
        ],
        0,
      ),
    ).toBe(570)
  })

  test('never suggests a time past the end of the day', () => {
    expect(
      suggestStartMinute([task({ id: 'a', startMinute: 1400, durationMinutes: 60 })], 0),
    ).toBe(24 * 60 - 1)
  })
})
