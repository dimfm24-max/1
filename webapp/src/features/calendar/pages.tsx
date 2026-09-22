import { useState } from 'react'

import { Typography } from '@/components/typography'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { toDayDate } from '@/features/day'
import { useGoalTreeQuery } from '@/features/goals'
import {
  dayOfMonth,
  formatMonth,
  monthGrid,
  monthOf,
  shiftMonth,
  weekdayHeadings,
} from './calendar'

/**
 * A month at a glance. The calendar owns no data of its own: it marks the days that goals put
 * there, which is what a person comes here to see - what is due, and how far away it is.
 */
export function CalendarPage() {
  const [today] = useState(() => toDayDate(new Date()))
  const [month, setMonth] = useState(() => monthOf(today))
  const goals = useGoalTreeQuery()

  const deadlines = new Map<string, string[]>()
  for (const goal of goals.data?.goals ?? []) {
    if (goal.status !== 'active') continue
    const date = goal.deadline.slice(0, 10)
    deadlines.set(date, [...(deadlines.get(date) ?? []), goal.title])
  }

  const grid = monthGrid(month, today)

  return (
    <section className="flex flex-col gap-6 p-4 md:p-6" data-testid="calendar-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography as="h1" variant="h5">
          {formatMonth(month)}
        </Typography>
        <div className="flex gap-2">
          <Button
            data-testid="calendar-previous"
            onClick={() => setMonth(shiftMonth(month, -1))}
            size="sm"
            type="button"
            variant="outline"
          >
            Назад
          </Button>
          <Button
            data-testid="calendar-today"
            disabled={month === monthOf(today)}
            onClick={() => setMonth(monthOf(today))}
            size="sm"
            type="button"
            variant="outline"
          >
            Текущий
          </Button>
          <Button
            data-testid="calendar-next"
            onClick={() => setMonth(shiftMonth(month, 1))}
            size="sm"
            type="button"
            variant="outline"
          >
            Вперёд
          </Button>
        </div>
      </div>

      <Card data-testid="calendar-grid">
        <CardHeader>
          <Typography as="h2" variant="h6">
            Сроки целей
          </Typography>
          <CardDescription>
            Отмечены дни, на которые назначены сроки целей в работе.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <ul className="grid grid-cols-7 gap-1">
            {weekdayHeadings.map((heading) => (
              <li key={heading}>
                <Typography tone="muted" variant="caption">
                  {heading}
                </Typography>
              </li>
            ))}
          </ul>
          <ul className="grid grid-cols-7 gap-1">
            {grid.map((cell) => {
              const due = deadlines.get(cell.date) ?? []
              return (
                <li
                  className={cellClass(cell.isCurrentMonth, cell.isToday)}
                  data-testid={`calendar-day-${cell.date}`}
                  key={cell.date}
                  title={due.length === 0 ? undefined : due.join(', ')}
                >
                  <Typography variant="caption">{String(dayOfMonth(cell.date))}</Typography>
                  {due.length === 0 ? null : (
                    <Badge
                      data-testid={`calendar-due-${cell.date}`}
                      variant={cell.isCurrentMonth ? 'default' : 'outline'}
                    >
                      {String(due.length)}
                    </Badge>
                  )}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}

function cellClass(isCurrentMonth: boolean, isToday: boolean) {
  const base = 'flex min-h-16 flex-col gap-1 rounded-md border p-1'
  if (!isCurrentMonth) return `${base} opacity-40`
  return isToday ? `${base} border-primary` : base
}
