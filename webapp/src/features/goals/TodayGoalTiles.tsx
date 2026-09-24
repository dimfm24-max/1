import { Link } from '@tanstack/react-router'

import { DashboardTile, ProgressRing } from '@/components/dashboard'
import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToneText } from '@/features/tone'
import { dayWord, describeGoal, formatDeadline, pickMainGoal } from './goal-view'
import { useGoalTreeQuery } from './queries'

/**
 * The main goal on the Today screen: how far it has come and what it serves. Its numbers come
 * from the same `describeGoal` as the goal card, so the two screens cannot disagree.
 */
export function MainGoalTile({ today }: { today: string }) {
  const tree = useGoalTreeQuery()
  const label = 'Главная цель'

  if (tree.isPending) {
    return (
      <DashboardTile label={label} testId="today-goal-loading">
        <Skeleton className="h-34 w-full" />
      </DashboardTile>
    )
  }

  if (tree.isError) {
    return (
      <DashboardTile label={label} testId="today-goal-error">
        <Typography tone="muted" variant="bodySm">
          Не удалось загрузить цели. Проверь соединение и обнови страницу.
        </Typography>
      </DashboardTile>
    )
  }

  const goal = pickMainGoal(tree.data.goals)
  if (!goal) {
    return (
      <DashboardTile label={label} testId="today-goal-empty">
        <Typography tone="muted" variant="bodySm">
          {tree.data.lifeGoal
            ? 'Цели в работе нет. Поставь цель — и каждый день будет вести к ней.'
            : 'Начни с дела жизни и первой цели — тогда день будет вести к ней.'}
        </Typography>
        <Button asChild className="self-start" data-testid="today-goal-create" variant="secondary">
          <Link to="/app/goals">Поставить цель</Link>
        </Button>
      </DashboardTile>
    )
  }

  const view = describeGoal(goal, today)

  return (
    <DashboardTile
      action={
        <Button asChild size="sm" variant="ghost">
          <Link to="/app/goals">Все цели</Link>
        </Button>
      }
      label={label}
      testId="today-goal"
    >
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <ProgressRing
          label={`Цель выполнена на ${view.completionPercent}%`}
          value={view.completionPercent}
        >
          <Typography data-testid="today-goal-percent" variant="metricSm">
            {view.completionPercent}%
          </Typography>
        </ProgressRing>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Typography as="h3" pretty variant="h4">
            {goal.title}
          </Typography>
          <Typography tone="muted" variant="bodySm">
            {view.measureLine}
          </Typography>
          {tree.data.lifeGoal ? (
            <Typography tone="muted" variant="bodySm">
              Дело жизни: {tree.data.lifeGoal.title}
            </Typography>
          ) : null}
        </div>
      </div>
    </DashboardTile>
  )
}

/** Days left to the main goal's deadline, set large: the count is the reason to act today. */
export function GoalDeadlineTile({ today }: { today: string }) {
  const tree = useGoalTreeQuery()
  const say = useToneText()
  const label = 'До срока цели'

  if (tree.isPending) {
    return (
      <DashboardTile label={label} testId="today-deadline-loading">
        <Skeleton className="h-24 w-full" />
      </DashboardTile>
    )
  }

  const goal = tree.isError ? null : pickMainGoal(tree.data.goals)
  if (!goal) {
    return (
      <DashboardTile label={label} testId="today-deadline-empty">
        <Typography tone="muted" variant="bodySm">
          {tree.isError ? 'Срок сейчас недоступен.' : 'Срок появится вместе с целью.'}
        </Typography>
      </DashboardTile>
    )
  }

  const { daysLeft, isOverdue, deadlineState } = describeGoal(goal, today)
  const days = Math.abs(daysLeft)
  // Every other open goal whose own warning window has come (task 09): the main one is above.
  const others = (tree.data?.goals ?? [])
    .filter((other) => other.status === 'active' && other.id !== goal.id)
    .map((other) => ({ goal: other, view: describeGoal(other, today) }))
    .filter(({ view }) => view.deadlineState !== 'on-track')

  return (
    <DashboardTile label={isOverdue ? 'Срок цели прошёл' : label} testId="today-deadline">
      <div className="flex items-baseline gap-2">
        <Typography
          data-testid="today-deadline-days"
          tone={isOverdue ? 'destructive' : undefined}
          variant="metric"
        >
          {days}
        </Typography>
        <Typography tone="muted" variant="h5">
          {dayWord(days)}
        </Typography>
      </div>
      <Typography
        className="mt-auto"
        data-testid="today-deadline-note"
        tone={deadlineState === 'warning' || deadlineState === 'last-day' ? 'destructive' : 'muted'}
        variant="bodySm"
      >
        {isOverdue
          ? `Срок был ${formatDeadline(goal.deadline)}. Продли его или закрой цель.`
          : deadlineState === 'last-day'
            ? say('deadlineLastDay', { goal: goal.title })
            : deadlineState === 'warning'
              ? say('deadlineSoon', { goal: goal.title, days: daysLeft })
              : `Срок ${formatDeadline(goal.deadline)}.`}
      </Typography>
      {others.length > 0 ? (
        <ul className="flex flex-col gap-1" data-testid="today-deadline-others">
          {others.map(({ goal: other, view }) => (
            <li key={other.id}>
              <Typography tone="destructive" variant="caption">
                {view.deadlineState === 'overdue'
                  ? say('deadlineOverdue', { goal: other.title })
                  : view.deadlineState === 'last-day'
                    ? say('deadlineLastDay', { goal: other.title })
                    : say('deadlineSoon', { goal: other.title, days: view.daysLeft })}
              </Typography>
            </li>
          ))}
        </ul>
      ) : null}
    </DashboardTile>
  )
}
