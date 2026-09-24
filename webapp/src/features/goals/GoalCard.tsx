import { MoreHorizontalIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { GoalDto } from '@dilife/contracts'
import { useState, type ReactNode } from 'react'

import { ProgressRing } from '@/components/dashboard'
import { SortableList } from '@/components/SortableList'
import { Typography } from '@/components/typography'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { useTrashedNotice } from '@/features/trash'
import { formatDate, pluralForm } from '@/platform/intl'
import { CloseGoalDialog, DeadlineDialog, ProgressDialog } from './GoalDialogs'
import { GoalFormDialog } from './GoalFormDialog'
import {
  describeGoal,
  formatDaysLeft,
  formatDeadline,
  type GoalView,
  type StepContext,
} from './goal-view'
import {
  useCreateStageMutation,
  useCreateStepMutation,
  useDeleteGoalMutation,
  useReorderStagesMutation,
  useReorderStepsMutation,
  useSetPrimaryGoalMutation,
  useUpdateStepMutation,
} from './queries'
import { TreeItemDialog, type TreeItem } from './TreeItemDialog'

type OpenDialog =
  | { kind: 'edit' }
  | { kind: 'progress' }
  | { kind: 'close'; status: 'completed' | 'abandoned' }
  | { kind: 'deadline'; mode: 'reopen' | 'extend' }
  | { kind: 'item'; item: TreeItem }
  | null

/**
 * A goal with its stages and steps, open on the page rather than behind a route. The tree is the
 * thing being worked on, so collapsing a goal into a link would mean a click between naming a
 * goal and breaking it down - which is exactly the step people skip.
 */
export function GoalCard({
  goal,
  isHighlighted = false,
  onTrashed,
  renderStepAction,
  today,
}: {
  goal: GoalDto
  /** The goal an address pointed at (`/app/goals?goal=…`): scrolled into view and outlined. */
  isHighlighted?: boolean
  /** Tells the page a goal went to the trash, so it can offer «Отменить». */
  onTrashed?: (goal: GoalDto) => void
  renderStepAction?: (context: StepContext) => ReactNode
  today: string
}) {
  const view = describeGoal(goal, today)
  const [dialog, setDialog] = useState<OpenDialog>(null)
  const setPrimary = useSetPrimaryGoalMutation()
  const remove = useDeleteGoalMutation()
  const notifyTrashed = useTrashedNotice()
  const closeDialog = (open: boolean) => {
    if (!open) setDialog(null)
  }

  return (
    <Card
      className={[
        isHighlighted ? 'ring-2 ring-primary' : '',
        view.isClosed ? 'opacity-80' : '',
      ].join(' ')}
      data-highlighted={isHighlighted || undefined}
      data-testid={`goal-card-${goal.id}`}
      ref={(element) => {
        if (element && isHighlighted) element.scrollIntoView({ block: 'center' })
      }}
    >
      <CardHeader className="gap-3">
        <div className="flex items-start gap-4">
          {goal.isPrimary ? (
            <ProgressRing
              label={`Цель выполнена на ${view.completionPercent} процентов`}
              size={96}
              value={view.completionPercent}
            >
              <Typography className="tabular-nums" variant="h4">
                {view.completionPercent}%
              </Typography>
            </ProgressRing>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Typography as="h3" variant="h5">
                {goal.title}
              </Typography>
              {goal.isPrimary ? <Badge data-testid="goal-primary-badge">Главная</Badge> : null}
              {view.isClosed ? (
                <Badge variant="outline">
                  {goal.status === 'completed' ? 'Завершена' : 'Брошена'}
                </Badge>
              ) : null}
              {view.deadlineState === 'overdue' ? (
                <Badge data-testid="goal-overdue-badge" variant="destructive">
                  Срок прошёл
                </Badge>
              ) : null}
            </div>
            <GoalNumbers goal={goal} view={view} />
          </div>
          <GoalMenu
            goal={goal}
            onDelete={() =>
              remove.mutate(goal.id, {
                onSuccess: () => onTrashed?.(goal),
              })
            }
            onOpen={setDialog}
            onPrimary={() => setPrimary.mutate(goal.id)}
            view={view}
          />
        </div>
        {goal.isPrimary ? null : (
          <div className="flex items-center gap-3">
            <Progress
              aria-label={`Продвижение цели «${goal.title}»`}
              data-testid={`goal-progress-${goal.id}`}
              value={view.completionPercent}
            />
            <Typography className="tabular-nums" variant="bodySmMedium">
              {view.completionPercent}%
            </Typography>
          </div>
        )}
        <DeadlineLine goal={goal} onExtend={() => setDialog({ kind: 'deadline', mode: 'extend' })} view={view} />
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {goal.description ? (
          <Typography tone="muted" variant="bodySm">
            {goal.description}
          </Typography>
        ) : null}
        {goal.outcomeNote ? (
          <Typography data-testid="goal-outcome-note" variant="bodySm">
            Итог: {goal.outcomeNote}
          </Typography>
        ) : null}

        <StageList
          goal={goal}
          onOpenItem={(item) => setDialog({ kind: 'item', item })}
          readOnly={view.isClosed}
          renderStepAction={renderStepAction}
        />
        {goal.progressMode === 'automatic' && view.totalSteps === 0 && !view.isClosed ? (
          <Typography tone="muted" variant="caption">
            Продвижение считается по шагам. Добавь шаги — и полоса начнёт двигаться.
          </Typography>
        ) : null}
        {view.isClosed ? null : <AddStage goalId={goal.id} />}
      </CardContent>

      {dialog?.kind === 'edit' ? (
        <GoalFormDialog goal={goal} onOpenChange={closeDialog} open today={today} />
      ) : null}
      {dialog?.kind === 'progress' ? (
        <ProgressDialog goal={goal} onOpenChange={closeDialog} open />
      ) : null}
      {dialog?.kind === 'close' ? (
        <CloseGoalDialog goal={goal} onOpenChange={closeDialog} open status={dialog.status} />
      ) : null}
      {dialog?.kind === 'deadline' ? (
        <DeadlineDialog goal={goal} mode={dialog.mode} onOpenChange={closeDialog} open today={today} />
      ) : null}
      {dialog?.kind === 'item' ? (
        <TreeItemDialog
          item={dialog.item}
          onDeleted={(kind, id, label) => notifyTrashed(kind, id, label)}
          onOpenChange={closeDialog}
          open
          readOnly={view.isClosed}
        />
      ) : null}
    </Card>
  )
}

function GoalNumbers({ goal, view }: { goal: GoalDto; view: GoalView }) {
  return (
    <Typography tone="muted" variant="bodySm">
      {view.measureLine} · {view.completedSteps} из {view.totalSteps}{' '}
      {pluralForm(view.totalSteps, ['шага', 'шагов', 'шагов'])}
      {view.isClosed && goal.completedAt ? ` · закрыта ${formatDate(goal.completedAt)}` : ''}
    </Typography>
  )
}

function DeadlineLine({
  goal,
  onExtend,
  view,
}: {
  goal: GoalDto
  onExtend: () => void
  view: GoalView
}) {
  if (view.isClosed) return null
  const text = `Срок ${formatDeadline(goal.deadline)} — ${formatDaysLeft(view.daysLeft)}`
  if (view.deadlineState === 'overdue') {
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid="goal-deadline-line">
        <Typography tone="destructive" variant="bodySmMedium">
          {text}. Продли срок или закрой цель.
        </Typography>
        <Button onClick={onExtend} size="sm" type="button" variant="outline">
          Продлить
        </Button>
      </div>
    )
  }
  return (
    <Typography
      data-testid="goal-deadline-line"
      tone={view.deadlineState === 'on-track' ? 'muted' : 'destructive'}
      variant={view.deadlineState === 'on-track' ? 'bodySm' : 'bodySmMedium'}
    >
      {text}
    </Typography>
  )
}

function GoalMenu({
  goal,
  onDelete,
  onOpen,
  onPrimary,
  view,
}: {
  goal: GoalDto
  onDelete: () => void
  onOpen: (dialog: OpenDialog) => void
  onPrimary: () => void
  view: GoalView
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Действия с целью «${goal.title}»`}
          data-testid={`goal-menu-${goal.id}`}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon aria-hidden icon={MoreHorizontalIcon} strokeWidth={2} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {view.isClosed ? (
          <DropdownMenuItem
            data-testid={`goal-reopen-${goal.id}`}
            onSelect={() => onOpen({ kind: 'deadline', mode: 'reopen' })}
          >
            Вернуть в работу
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem data-testid={`goal-edit-${goal.id}`} onSelect={() => onOpen({ kind: 'edit' })}>
              Изменить
            </DropdownMenuItem>
            {goal.isPrimary ? null : (
              <DropdownMenuItem data-testid={`goal-primary-${goal.id}`} onSelect={onPrimary}>
                Сделать главной
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuItem
          data-testid={`goal-progress-open-${goal.id}`}
          onSelect={() => onOpen({ kind: 'progress' })}
        >
          {goal.progressMode === 'manual' && !view.isClosed ? 'Записать показатель' : 'История показателя'}
        </DropdownMenuItem>
        {view.isClosed ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid={`goal-close-${goal.id}`}
              onSelect={() => onOpen({ kind: 'close', status: 'completed' })}
            >
              Завершить
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid={`goal-abandon-${goal.id}`}
              onSelect={() => onOpen({ kind: 'close', status: 'abandoned' })}
            >
              Отказаться
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid={`goal-delete-${goal.id}`} onSelect={onDelete} variant="destructive">
          Удалить в корзину
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function StageList({
  goal,
  onOpenItem,
  readOnly,
  renderStepAction,
}: {
  goal: GoalDto
  onOpenItem: (item: TreeItem) => void
  readOnly: boolean
  renderStepAction?: (context: StepContext) => ReactNode
}) {
  const reorder = useReorderStagesMutation()

  if (goal.stages.length === 0) {
    return (
      <Typography tone="muted" variant="bodySm">
        Этапов пока нет. Разбей цель на части — так до неё проще дойти.
      </Typography>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <SortableList
        disabled={readOnly}
        handleLabel={(stage) => `Перетащить этап «${stage.title}»`}
        items={goal.stages}
        onReorder={(ids) => reorder.mutate({ goalId: goal.id, ids })}
        renderItem={(stage, handle) => (
          <StageBlock
            goal={goal}
            handle={handle}
            onOpenItem={onOpenItem}
            readOnly={readOnly}
            renderStepAction={renderStepAction}
            stage={stage}
          />
        )}
      />
    </div>
  )
}

function StageBlock({
  goal,
  handle,
  onOpenItem,
  readOnly,
  renderStepAction,
  stage,
}: {
  goal: GoalDto
  handle: ReactNode
  onOpenItem: (item: TreeItem) => void
  readOnly: boolean
  renderStepAction?: (context: StepContext) => ReactNode
  stage: GoalDto['stages'][number]
}) {
  const updateStep = useUpdateStepMutation()
  const reorder = useReorderStepsMutation()

  return (
    <div className="mb-3 rounded-lg border p-3" data-testid={`stage-${stage.id}`}>
      <div className="flex items-center gap-1">
        {handle ?? null}
        <Button
          className="h-auto min-w-0 flex-1 justify-start px-1 py-1 text-left whitespace-normal"
          data-testid={`stage-open-${stage.id}`}
          onClick={() => onOpenItem({ kind: 'stage', stage })}
          type="button"
          variant="ghost"
        >
          <Typography variant="bodySmMedium">{stage.title}</Typography>
        </Button>
      </div>
      {stage.description ? (
        <Typography tone="muted" variant="caption">
          {stage.description}
        </Typography>
      ) : null}
      <div className="mt-2 flex flex-col gap-1">
        <SortableList
          disabled={readOnly}
          handleLabel={(step) => `Перетащить шаг «${step.title}»`}
          items={stage.steps}
          onReorder={(ids) => reorder.mutate({ stageId: stage.id, ids })}
          renderItem={(step, stepHandle) => (
            <div className="flex items-center gap-1">
              {stepHandle ?? null}
              <Checkbox
                aria-label={step.title}
                checked={step.completedAt !== null}
                data-testid={`step-${step.id}`}
                disabled={readOnly || updateStep.isPending}
                onCheckedChange={(checked) =>
                  updateStep.mutate({ stepId: step.id, input: { isCompleted: checked === true } })
                }
              />
              <Button
                className="h-auto min-w-0 flex-1 justify-start px-2 py-1 text-left whitespace-normal"
                data-testid={`step-open-${step.id}`}
                onClick={() => onOpenItem({ kind: 'step', step })}
                type="button"
                variant="ghost"
              >
                <Typography tone={step.completedAt === null ? undefined : 'muted'} variant="bodySm">
                  {step.title}
                  {step.estimatedMinutes ? ` · ${step.estimatedMinutes} мин` : ''}
                </Typography>
              </Button>
              {!readOnly && step.completedAt === null && renderStepAction
                ? renderStepAction({ goal, stage, step })
                : null}
            </div>
          )}
        />
      </div>
      {readOnly ? null : <AddStep stage={stage} />}
    </div>
  )
}

function AddStage({ goalId }: { goalId: string }) {
  const [title, setTitle] = useState('')
  const createStage = useCreateStageMutation()
  const add = () => {
    const trimmed = title.trim()
    if (trimmed === '') return
    createStage.mutate({ goalId, input: { title: trimmed } }, { onSuccess: () => setTitle('') })
  }
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault()
        add()
      }}
    >
      <Input
        aria-label="Название этапа"
        data-testid={`stage-input-${goalId}`}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Новый этап"
        value={title}
      />
      <Button
        data-testid={`stage-submit-${goalId}`}
        disabled={title.trim() === '' || createStage.isPending}
        type="submit"
        variant="secondary"
      >
        Добавить этап
      </Button>
    </form>
  )
}

function AddStep({ stage }: { stage: GoalDto['stages'][number] }) {
  const [title, setTitle] = useState('')
  const createStep = useCreateStepMutation()
  const add = () => {
    const trimmed = title.trim()
    if (trimmed === '') return
    createStep.mutate({ stageId: stage.id, input: { title: trimmed } }, { onSuccess: () => setTitle('') })
  }
  return (
    <form
      className="mt-3 flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault()
        add()
      }}
    >
      <Input
        aria-label={`Новый шаг этапа «${stage.title}»`}
        data-testid={`step-input-${stage.id}`}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Новый шаг"
        value={title}
      />
      <Button
        data-testid={`step-submit-${stage.id}`}
        disabled={title.trim() === '' || createStep.isPending}
        size="sm"
        type="submit"
        variant="secondary"
      >
        Добавить шаг
      </Button>
    </form>
  )
}
