import type { GoalDto } from '@dilife/contracts'
import { useState, type ReactNode } from 'react'

import { Typography } from '@/components/typography'
import { ViewTabs } from '@/components/ViewTabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToday } from '@/features/settings'
import { useTrashedNotice } from '@/features/trash'
import { GoalCard } from './GoalCard'
import type { StepContext } from './goal-view'
import { GoalFormDialog } from './GoalFormDialog'
import { LifeGoalPanel } from './LifeGoalPanel'
import { useGoalTreeQuery } from './queries'

export type GoalsView = 'active' | 'archive'

const tabs = [
  { id: 'active', label: 'В работе' },
  { id: 'archive', label: 'Архив' },
] as const

export function GoalsPage({
  highlightGoalId,
  onViewChange,
  renderStepAction,
  view = 'active',
}: {
  highlightGoalId?: string
  onViewChange: (view: GoalsView) => void
  /** «В план» beside each open step, supplied by the day plan (task 16). */
  renderStepAction?: (context: StepContext) => ReactNode
  view?: GoalsView
}) {
  const tree = useGoalTreeQuery()
  // One clock for the whole render, so two cards can never disagree about what today is.
  const { today } = useToday()
  const [creating, setCreating] = useState(false)
  const notifyTrashed = useTrashedNotice()

  if (tree.isPending) {
    return (
      <section className="flex flex-col gap-5 p-4 md:p-8" data-testid="goals-loading">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </section>
    )
  }

  if (tree.isError) {
    return (
      <section className="p-4 md:p-8">
        <Alert data-testid="goals-error" variant="destructive">
          <AlertTitle>Не удалось загрузить цели</AlertTitle>
          <AlertDescription>Проверь интернет и обнови страницу.</AlertDescription>
        </Alert>
      </section>
    )
  }

  const { lifeGoal, goals } = tree.data
  const active = goals.filter((goal) => goal.status === 'active')
  const closed = goals.filter((goal) => goal.status !== 'active')
  // A highlighted closed goal opens the archive, so a link to it never lands on nothing.
  const shownView = highlightGoalId && closed.some((goal) => goal.id === highlightGoalId) ? 'archive' : view
  const trashed = (goal: GoalDto) => notifyTrashed('goal', goal.id, `Цель «${goal.title}»`)

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 md:p-8" data-testid="goals-page">
      <LifeGoalPanel
        activeGoals={active.length}
        detachedGoals={lifeGoal === null ? goals.length : 0}
        lifeGoal={lifeGoal}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewTabs
          active={shownView}
          label="Цели"
          onSelect={onViewChange}
          tabs={tabs}
          testId="goals-view"
        />
        <Button
          data-testid="goal-create-open"
          disabled={lifeGoal === null}
          onClick={() => setCreating(true)}
          type="button"
        >
          Новая цель
        </Button>
      </div>

      {lifeGoal === null && goals.length > 0 ? (
        <Typography data-testid="goals-detached" tone="muted" variant="bodySm">
          Цели без дела жизни работают как раньше. Назови новое дело жизни — они вернутся под него.
        </Typography>
      ) : null}

      {shownView === 'active' ? (
        <div className="flex flex-col gap-4">
          {active.length === 0 ? (
            <div className="flex flex-col items-start gap-3" data-testid="goals-empty">
              <Typography tone="muted" variant="bodySm">
                {lifeGoal === null
                  ? 'Сначала назови дело жизни — цели живут под ним.'
                  : 'Пока ни одной цели. Первая станет главной — её видно на экране «Сегодня».'}
              </Typography>
              {lifeGoal === null ? null : (
                <Button onClick={() => setCreating(true)} type="button" variant="outline">
                  Поставить первую цель
                </Button>
              )}
            </div>
          ) : (
            active.map((goal) => (
              <GoalCard
                goal={goal}
                isHighlighted={goal.id === highlightGoalId}
                key={goal.id}
                onTrashed={trashed}
                renderStepAction={renderStepAction}
                today={today}
              />
            ))
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4" data-testid="goals-archive">
          {closed.length === 0 ? (
            <Typography tone="muted" variant="bodySm">
              В архиве пусто. Сюда попадают завершённые цели и те, от которых ты отказался, вместе с
              итогом.
            </Typography>
          ) : (
            closed.map((goal) => (
              <GoalCard
                goal={goal}
                isHighlighted={goal.id === highlightGoalId}
                key={goal.id}
                onTrashed={trashed}
                renderStepAction={renderStepAction}
                today={today}
              />
            ))
          )}
        </div>
      )}

      {creating ? <GoalFormDialog onOpenChange={setCreating} open today={today} /> : null}
    </section>
  )
}
