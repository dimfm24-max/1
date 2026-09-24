import { FireIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'

import { DashboardTile } from '@/components/dashboard'
import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { topStreaks } from './habit-view'
import { useHabitsQuery } from './queries'

const shownHabits = 4

/** The longest current runs, as a reason not to break them today. */
export function HabitStreaksTile({ today }: { today: string }) {
  const habits = useHabitsQuery(today)
  const label = 'Серии привычек'
  const openHabits = (
    <Button asChild size="sm" variant="ghost">
      <Link to="/app/habits">Все привычки</Link>
    </Button>
  )

  if (habits.isPending) {
    return (
      <DashboardTile label={label} testId="today-streaks-loading">
        <Skeleton className="h-40 w-full" />
      </DashboardTile>
    )
  }

  if (habits.isError) {
    return (
      <DashboardTile action={openHabits} label={label} testId="today-streaks-error">
        <Typography tone="muted" variant="bodySm">
          Серии сейчас недоступны.
        </Typography>
      </DashboardTile>
    )
  }

  const shown = topStreaks(habits.data.habits, shownHabits)
  if (shown.length === 0) {
    return (
      <DashboardTile label={label} testId="today-streaks-empty">
        <Typography tone="muted" variant="bodySm">
          Привычек пока нет. Заведи одну — серия дней держит лучше любого напоминания.
        </Typography>
        <Button asChild className="self-start" variant="secondary">
          <Link to="/app/habits">Завести привычку</Link>
        </Button>
      </DashboardTile>
    )
  }

  return (
    <DashboardTile action={openHabits} label={label} testId="today-streaks">
      <ul className="flex flex-col gap-3">
        {shown.map((habit) => (
          <li className="flex items-center gap-3" data-testid={`today-streak-${habit.id}`} key={habit.id}>
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-chart-4/15 text-chart-4"
            >
              <HugeiconsIcon className="size-5" icon={FireIcon} strokeWidth={2} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <Typography truncate variant="bodySmMedium">
                {habit.title}
              </Typography>
              <Typography tone="muted" variant="caption">
                Рекорд: {habit.longestStreak} дн.
              </Typography>
            </span>
            <span className="flex items-baseline gap-1">
              <Typography
                as="span"
                className="tabular-nums"
                tone={habit.currentStreak === 0 ? 'muted' : undefined}
                variant="h3"
              >
                {habit.currentStreak}
              </Typography>
              <Typography tone="muted" variant="caption">
                дн.
              </Typography>
            </span>
          </li>
        ))}
      </ul>
    </DashboardTile>
  )
}
