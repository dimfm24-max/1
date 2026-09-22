import type {
  CreateHabitRequest,
  HabitDto,
  MarkHabitRequest,
  UpdateHabitRequest,
} from '@dilife/contracts'

import type { DbClient } from '../../../db'
import type { HabitsRepository } from '../application/ports'
import { HabitsFailure } from '../domain/errors'
import { currentStreak, longestStreak, type HabitPlan } from '../domain/streak'

const habitSelect = {
  id: true,
  title: true,
  schedule: true,
  weekdays: true,
  intervalDays: true,
  startedOn: true,
  archivedAt: true,
  color: true,
  position: true,
  marks: { orderBy: { markedOn: 'desc' }, select: { markedOn: true } },
} as const

type HabitRow = {
  id: string
  title: string
  schedule: 'daily' | 'weekdays' | 'interval'
  weekdays: number[]
  intervalDays: number
  startedOn: Date
  archivedAt: Date | null
  color: string | null
  position: number
  marks: Array<{ markedOn: Date }>
}

function toDayDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`)
}

function fromDayDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function createPrismaHabitsRepository(db: DbClient): HabitsRepository {
  function toDto(row: HabitRow, today: string): HabitDto {
    const marks = row.marks.map((mark) => fromDayDate(mark.markedOn))
    const plan: HabitPlan = {
      schedule: row.schedule,
      weekdays: row.weekdays,
      intervalDays: row.intervalDays,
      startedOn: fromDayDate(row.startedOn),
    }
    // Streaks are computed rather than stored: a mark added for a day in the past has to change
    // the answer, and a stored counter would have to be rebuilt on every such edit anyway.
    const marked = new Set(marks)
    return {
      id: row.id,
      title: row.title,
      schedule: row.schedule,
      weekdays: row.weekdays,
      intervalDays: row.intervalDays,
      startedOn: plan.startedOn,
      archivedAt: row.archivedAt?.toISOString() ?? null,
      color: row.color,
      position: row.position,
      marks,
      currentStreak: currentStreak(plan, marked, today),
      longestStreak: longestStreak(plan, marked, today),
    }
  }

  async function list(userId: string, today: string) {
    const habits = await db.habit.findMany({
      where: { userId },
      orderBy: [{ archivedAt: 'asc' }, { position: 'asc' }],
      select: habitSelect,
    })
    return habits.map((habit) => toDto(habit as HabitRow, today))
  }

  async function readHabit(userId: string, habitId: string, today: string) {
    const habit = await db.habit.findFirst({
      where: { id: habitId, userId },
      select: habitSelect,
    })
    if (!habit) throw new HabitsFailure('not_found', 'Habit not found')
    return toDto(habit as HabitRow, today)
  }

  return {
    list,

    async create(userId, input: CreateHabitRequest, today) {
      const last = await db.habit.findFirst({
        where: { userId },
        orderBy: { position: 'desc' },
        select: { position: true },
      })
      const created = await db.habit.create({
        data: {
          userId,
          title: input.title,
          schedule: input.schedule,
          weekdays: input.weekdays ?? [],
          intervalDays: input.intervalDays ?? 1,
          startedOn: toDayDate(input.startedOn),
          color: input.color ?? null,
          position: (last?.position ?? -1) + 1,
        },
        select: habitSelect,
      })
      return toDto(created as HabitRow, today)
    },

    async update(userId, habitId, input: UpdateHabitRequest, today, now) {
      const existing = await db.habit.findFirst({
        where: { id: habitId, userId },
        select: { id: true, archivedAt: true },
      })
      if (!existing) throw new HabitsFailure('not_found', 'Habit not found')

      await db.habit.update({
        where: { id: habitId },
        data: {
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.schedule === undefined ? {} : { schedule: input.schedule }),
          ...(input.weekdays === undefined ? {} : { weekdays: input.weekdays }),
          ...(input.intervalDays === undefined ? {} : { intervalDays: input.intervalDays }),
          ...(input.color === undefined ? {} : { color: input.color }),
          // Archiving keeps every mark: a habit kept for three months and then stopped is part
          // of the history, not a mistake to erase.
          ...(input.isArchived === undefined
            ? {}
            : { archivedAt: input.isArchived ? (existing.archivedAt ?? now) : null }),
        },
      })
      return readHabit(userId, habitId, today)
    },

    async mark(userId, habitId, input: MarkHabitRequest, today) {
      const habit = await db.habit.findFirst({
        where: { id: habitId, userId },
        select: { id: true },
      })
      if (!habit) throw new HabitsFailure('not_found', 'Habit not found')

      const markedOn = toDayDate(input.markedOn)
      if (input.isDone) {
        // Idempotent by day: the same day twice is the same fact, not two.
        await db.habitMark.upsert({
          where: { habitId_markedOn: { habitId, markedOn } },
          create: { habitId, userId, markedOn },
          update: {},
        })
      } else {
        await db.habitMark.deleteMany({ where: { habitId, markedOn } })
      }
      return readHabit(userId, habitId, today)
    },

    async remove(userId, habitId, today) {
      const deleted = await db.habit.deleteMany({ where: { id: habitId, userId } })
      if (deleted.count === 0) throw new HabitsFailure('not_found', 'Habit not found')
      return list(userId, today)
    },
  }
}
