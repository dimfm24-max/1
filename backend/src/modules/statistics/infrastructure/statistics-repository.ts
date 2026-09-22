import type { StatisticsPeriod, StatisticsResponse } from '@dilife/contracts'

import type { DbClient } from '../../../db'
import { currentStreak } from '../../habits'
import type { StatisticsReader } from '../application/ports'
import { eachDay, periodWindow } from '../domain/window'

function toDayDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`)
}

function fromDayDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function createPrismaStatisticsRepository(db: DbClient): StatisticsReader {
  return {
    async read(userId, period, today) {
      const window = periodWindow(period, today)
      const range = { gte: toDayDate(window.from), lte: toDayDate(window.to) }

      const tasks = await db.task.findMany({
        where: { userId, scheduledOn: range },
        select: {
          scheduledOn: true,
          outcome: true,
          durationMinutes: true,
          step: {
            select: {
              stage: { select: { goal: { select: { id: true, title: true } } } },
            },
          },
        },
      })

      const daily = new Map(
        eachDay(window.from, window.days).map((date) => [
          date,
          { date, planned: 0, done: 0, burned: 0 },
        ]),
      )
      const totals = { planned: 0, done: 0, burned: 0, doneMinutes: 0, activeDays: 0 }
      const goals = new Map<string, { goalId: string; title: string; minutes: number; completedSteps: number }>()
      const daysWithWork = new Set<string>()

      for (const task of tasks) {
        const date = fromDayDate(task.scheduledOn)
        const point = daily.get(date)
        if (!point) continue

        if (task.outcome === 'done') {
          point.done += 1
          totals.done += 1
          // Only finished work counts towards time spent: a planned hour that never happened
          // would otherwise read as effort.
          totals.doneMinutes += task.durationMinutes
          daysWithWork.add(date)

          const goal = task.step?.stage.goal
          if (goal) {
            const entry = goals.get(goal.id) ?? {
              goalId: goal.id,
              title: goal.title,
              minutes: 0,
              completedSteps: 0,
            }
            entry.minutes += task.durationMinutes
            entry.completedSteps += 1
            goals.set(goal.id, entry)
          }
          continue
        }
        if (task.outcome === 'burned') {
          point.burned += 1
          totals.burned += 1
          continue
        }
        point.planned += 1
        totals.planned += 1
      }

      totals.activeDays = daysWithWork.size

      const habits = await db.habit.findMany({
        where: { userId, archivedAt: null },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          schedule: true,
          weekdays: true,
          intervalDays: true,
          startedOn: true,
          // Every mark, not only the window: a streak is how long the habit has been kept, and
          // cropping it to seven days would report a two-month run as a week.
          marks: { select: { markedOn: true } },
        },
      })

      return {
        period,
        from: window.from,
        to: window.to,
        totals,
        daily: [...daily.values()],
        // Ordered by time spent: the question a person asks of this screen is where their hours
        // went, and an alphabetical list answers a different one.
        goals: [...goals.values()].sort((left, right) => right.minutes - left.minutes),
        habits: habits.map((habit) => {
          const marks = habit.marks.map((mark) => fromDayDate(mark.markedOn))
          return {
            habitId: habit.id,
            title: habit.title,
            currentStreak: currentStreak(
              {
                schedule: habit.schedule,
                weekdays: habit.weekdays,
                intervalDays: habit.intervalDays,
                startedOn: fromDayDate(habit.startedOn),
              },
              new Set(marks),
              today,
            ),
            // Days kept inside the window, which is the question this screen asks.
            markedDays: marks.filter((date) => date >= window.from && date <= window.to).length,
          }
        }),
      }
    },
  }
}
