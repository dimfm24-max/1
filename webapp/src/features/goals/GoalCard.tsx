import type { GoalDto } from '@dilife/contracts'
import { useState } from 'react'

import { Typography } from '@/components/typography'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { formatDate } from '@/platform/intl'
import { describeGoal, formatDaysLeft } from './goal-view'
import {
  useCloseGoalMutation,
  useCreateStageMutation,
  useCreateStepMutation,
  useDeleteGoalMutation,
  useReopenGoalMutation,
  useSetPrimaryGoalMutation,
  useUpdateStepMutation,
} from './queries'

/**
 * A goal with its stages and steps, open on the page rather than behind a route. The tree is the
 * thing being worked on, so collapsing a goal into a link would mean a click between naming a
 * goal and breaking it down - which is exactly the step people skip.
 */
export function GoalCard({ goal, now }: { goal: GoalDto; now: Date }) {
  const view = describeGoal(goal, now)
  const [stageTitle, setStageTitle] = useState('')
  const createStage = useCreateStageMutation()
  const setPrimary = useSetPrimaryGoalMutation()
  const close = useCloseGoalMutation()
  const reopen = useReopenGoalMutation()
  const remove = useDeleteGoalMutation()

  const addStage = () => {
    const title = stageTitle.trim()
    if (title === '') return
    createStage.mutate({ goalId: goal.id, input: { title } }, { onSuccess: () => setStageTitle('') })
  }

  return (
    <Card data-testid={`goal-card-${goal.id}`}>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Typography as="h3" variant="h6">
            {goal.title}
          </Typography>
          {goal.isPrimary ? <Badge data-testid="goal-primary-badge">Главная</Badge> : null}
          {view.isClosed ? (
            <Badge variant="outline">
              {goal.status === 'completed' ? 'Завершена' : 'Брошена'}
            </Badge>
          ) : null}
          {view.isOverdue ? <Badge variant="destructive">Просрочена</Badge> : null}
        </div>
        <Typography variant="caption" tone="muted">
          {goal.currentValue} из {goal.targetValue} {goal.measureUnit} ·{' '}
          {view.completedSteps} из {view.totalSteps} шагов ·{' '}
          {view.isClosed
            ? `закрыта ${goal.completedAt ? formatDate(goal.completedAt) : ''}`
            : `${formatDate(goal.deadline)}, ${formatDaysLeft(view.daysLeft)}`}
        </Typography>
        <Progress
          aria-label={`Продвижение цели «${goal.title}»`}
          data-testid={`goal-progress-${goal.id}`}
          value={view.completionPercent}
        />
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {goal.outcomeNote ? (
          <Typography variant="caption" tone="muted" data-testid="goal-outcome-note">
            Итог: {goal.outcomeNote}
          </Typography>
        ) : null}

        <div className="flex flex-col gap-3">
          {goal.stages.map((stage) => (
            <StageBlock goalClosed={view.isClosed} key={stage.id} stage={stage} />
          ))}
          {goal.stages.length === 0 ? (
            <Typography variant="caption" tone="muted">
              Этапов пока нет. Разбейте цель на части — так до неё проще дойти.
            </Typography>
          ) : null}
        </div>

        {view.isClosed ? null : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Название этапа"
              data-testid={`stage-input-${goal.id}`}
              maxLength={200}
              onChange={(event) => setStageTitle(event.target.value)}
              placeholder="Новый этап"
              value={stageTitle}
            />
            <Button
              data-testid={`stage-submit-${goal.id}`}
              disabled={stageTitle.trim() === '' || createStage.isPending}
              onClick={addStage}
              type="button"
              variant="secondary"
            >
              Добавить этап
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {goal.isPrimary || view.isClosed ? null : (
            <Button
              data-testid={`goal-primary-${goal.id}`}
              onClick={() => setPrimary.mutate(goal.id)}
              size="sm"
              type="button"
              variant="outline"
            >
              Сделать главной
            </Button>
          )}
          {view.isClosed ? (
            <Button
              data-testid={`goal-reopen-${goal.id}`}
              onClick={() =>
                reopen.mutate({ goalId: goal.id, deadline: monthFromNow(now).toISOString() })
              }
              size="sm"
              type="button"
              variant="outline"
            >
              Вернуть в работу
            </Button>
          ) : (
            <Button
              data-testid={`goal-close-${goal.id}`}
              onClick={() => close.mutate({ goalId: goal.id, input: { status: 'completed' } })}
              size="sm"
              type="button"
              variant="outline"
            >
              Завершить
            </Button>
          )}
          <Button
            data-testid={`goal-delete-${goal.id}`}
            onClick={() => remove.mutate(goal.id)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Удалить
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function StageBlock({
  goalClosed,
  stage,
}: {
  goalClosed: boolean
  stage: GoalDto['stages'][number]
}) {
  const [stepTitle, setStepTitle] = useState('')
  const createStep = useCreateStepMutation()
  const updateStep = useUpdateStepMutation()

  const addStep = () => {
    const title = stepTitle.trim()
    if (title === '') return
    createStep.mutate({ stageId: stage.id, input: { title } }, { onSuccess: () => setStepTitle('') })
  }

  return (
    <div className="rounded-lg border p-3" data-testid={`stage-${stage.id}`}>
      <Typography variant="bodySmMedium">{stage.title}</Typography>
      <ul className="mt-2 flex flex-col gap-2">
        {stage.steps.map((step) => (
          <li className="flex items-center gap-2" key={step.id}>
            <Checkbox
              aria-label={step.title}
              checked={step.completedAt !== null}
              data-testid={`step-${step.id}`}
              disabled={goalClosed || updateStep.isPending}
              onCheckedChange={(checked) =>
                updateStep.mutate({ stepId: step.id, input: { isCompleted: checked === true } })
              }
            />
            <Typography
              tone={step.completedAt === null ? undefined : 'muted'}
              variant="bodySm"
            >
              {step.title}
            </Typography>
          </li>
        ))}
      </ul>
      {goalClosed ? null : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label={`Новый шаг этапа «${stage.title}»`}
            data-testid={`step-input-${stage.id}`}
            maxLength={200}
            onChange={(event) => setStepTitle(event.target.value)}
            placeholder="Новый шаг"
            value={stepTitle}
          />
          <Button
            data-testid={`step-submit-${stage.id}`}
            disabled={stepTitle.trim() === '' || createStep.isPending}
            onClick={addStep}
            size="sm"
            type="button"
            variant="secondary"
          >
            Добавить шаг
          </Button>
        </div>
      )}
    </div>
  )
}

/** A reopened goal needs a deadline again; a month is a starting point the person can change. */
function monthFromNow(now: Date) {
  const deadline = new Date(now)
  deadline.setMonth(deadline.getMonth() + 1)
  return deadline
}
