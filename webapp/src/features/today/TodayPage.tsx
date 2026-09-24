import { Add01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import type { UserDto } from '@dilife/contracts'

import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import {
  DaySummaryTile,
  formatDayHeading,
  formatMinuteOfDay,
  TodayTimeline,
} from '@/features/day'
import { GoalDeadlineTile, MainGoalTile } from '@/features/goals'
import { HabitStreaksTile } from '@/features/habits'
import { useSettingsQuery, useToday } from '@/features/settings'
import { toneText } from '@/features/tone'
import { todayHeadline } from './today-view'

/**
 * The first screen after sign-in: the main goal, the days left to it, and today's plan with a
 * "now" mark. Each tile belongs to its feature; this screen only lays them out and keeps one
 * clock - the person's own, by their time zone - so every tile agrees on today and now.
 */
export function TodayPage({ user }: { user: UserDto }) {
  const { today, minuteOfDay: minute } = useToday()
  const context = useSettingsQuery()

  return (
    <section
      className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-8"
      data-testid="today-page"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <Typography tone="primary" variant="eyebrow">
            {formatDayHeading(today)} · {formatMinuteOfDay(minute)}
          </Typography>
          <Typography variant="display">{todayHeadline(minute, user.displayName)}</Typography>
          {context.isSuccess ? (
            <Typography tone="muted">{toneText(context.data.settings.tone, 'todayLine')}</Typography>
          ) : null}
        </div>
        <Button asChild className="self-start sm:self-auto" size="lg">
          <Link data-testid="today-add-task" to="/app/day">
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2.2} />
            Добавить задачу
          </Link>
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="md:col-span-2">
          <MainGoalTile today={today} />
        </div>
        <GoalDeadlineTile today={today} />
        <DaySummaryTile today={today} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <TodayTimeline minuteOfDay={minute} today={today} />
        <HabitStreaksTile today={today} />
      </div>
    </section>
  )
}

