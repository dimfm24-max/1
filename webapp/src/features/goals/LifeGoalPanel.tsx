import type { LifeGoalDto } from '@dilife/contracts'
import { useId, useState, type FormEvent } from 'react'

import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { describeApiError } from '@/platform/api'
import { formatCount } from '@/platform/intl'
import { useDeleteLifeGoalMutation, useUpsertLifeGoalMutation } from './queries'

/**
 * The top of the tree: the life goal's name, large, and how many goals are in work under it.
 * It has no progress of its own (§2). Renamed in place; deleted with a choice about its goals.
 */
export function LifeGoalPanel({
  activeGoals,
  detachedGoals,
  lifeGoal,
}: {
  activeGoals: number
  /** Goals waiting without a life goal; a new one takes them back by itself. */
  detachedGoals: number
  lifeGoal: LifeGoalDto | null
}) {
  const [editing, setEditing] = useState(lifeGoal === null)
  const [deleting, setDeleting] = useState(false)

  if (lifeGoal === null || editing) {
    return (
      <LifeGoalForm
        detachedGoals={detachedGoals}
        lifeGoal={lifeGoal}
        onDone={() => setEditing(false)}
      />
    )
  }

  return (
    <Card data-testid="life-goal-panel">
      <CardHeader className="gap-2">
        <Typography tone="muted" variant="eyebrow">
          Дело жизни
        </Typography>
        <Typography as="h1" data-testid="life-goal-title" variant="display">
          {lifeGoal.title}
        </Typography>
        <Typography tone="muted" variant="bodySm">
          {activeGoals === 0
            ? 'Целей в работе пока нет'
            : `В работе ${formatCount(activeGoals, ['цель', 'цели', 'целей'])}`}
        </Typography>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          data-testid="life-goal-rename"
          onClick={() => setEditing(true)}
          size="sm"
          type="button"
          variant="outline"
        >
          Переименовать
        </Button>
        <Button
          data-testid="life-goal-delete"
          onClick={() => setDeleting(true)}
          size="sm"
          type="button"
          variant="ghost"
        >
          Удалить дело жизни
        </Button>
      </CardContent>
      {deleting ? (
        <DeleteLifeGoalDialog activeGoals={activeGoals} onOpenChange={setDeleting} />
      ) : null}
    </Card>
  )
}

function LifeGoalForm({
  detachedGoals,
  lifeGoal,
  onDone,
}: {
  detachedGoals: number
  lifeGoal: LifeGoalDto | null
  onDone: () => void
}) {
  const inputId = useId()
  const mutation = useUpsertLifeGoalMutation()
  const [title, setTitle] = useState(lifeGoal?.title ?? '')
  const trimmed = title.trim()

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (trimmed === '') return
    mutation.mutate(trimmed, { onSuccess: onDone })
  }

  return (
    <Card data-testid="life-goal-panel">
      <CardHeader className="gap-1">
        <Typography as="h1" variant="h4">
          Дело жизни
        </Typography>
        <Typography tone="muted" variant="bodySm">
          {lifeGoal
            ? 'Новое название увидят все твои цели.'
            : detachedGoals > 0
              ? `Назови новое дело жизни — ${formatCount(detachedGoals, ['цель', 'цели', 'целей'])} без него вернутся под него сами.`
              : 'Назови то, ради чего ставишь цели. Без этого цель завести нельзя.'}
        </Typography>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={submit}>
          <Field className="flex-1">
            <FieldLabel htmlFor={inputId}>Название</FieldLabel>
            <Input
              data-testid="life-goal-input"
              id={inputId}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: быть здоровым и сильным"
              value={title}
            />
            <FieldDescription>Его можно переименовать в любой момент.</FieldDescription>
          </Field>
          <div className="flex gap-2">
            {lifeGoal ? (
              <Button onClick={onDone} type="button" variant="ghost">
                Отмена
              </Button>
            ) : null}
            <Button
              data-testid="life-goal-submit"
              disabled={trimmed === '' || trimmed === lifeGoal?.title || mutation.isPending}
              type="submit"
            >
              Сохранить
            </Button>
          </div>
        </form>
        {mutation.isError ? (
          <Typography tone="destructive" variant="bodySm">
            {describeApiError(mutation.error, 'Не сохранилось. Попробуй ещё раз.')}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** Two ways out (task 12): the goals go to the trash with it, or stay in work without it. */
function DeleteLifeGoalDialog({
  activeGoals,
  onOpenChange,
}: {
  activeGoals: number
  onOpenChange: (open: boolean) => void
}) {
  const mutation = useDeleteLifeGoalMutation()
  const run = (goals: 'trash' | 'detach') =>
    mutation.mutate(goals, { onSuccess: () => onOpenChange(false) })

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent data-testid="life-goal-delete-dialog">
        <DialogHeader>
          <DialogTitle>Удалить дело жизни?</DialogTitle>
          <DialogDescription>
            {activeGoals === 0
              ? 'Пока его нет, новую цель завести нельзя.'
              : 'Что сделать с целями под ним? Пока дела жизни нет, новую цель завести нельзя.'}
          </DialogDescription>
        </DialogHeader>
        {mutation.isError ? (
          <Typography tone="destructive" variant="bodySm">
            {describeApiError(mutation.error, 'Не получилось. Попробуй ещё раз.')}
          </Typography>
        ) : null}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            data-testid="life-goal-delete-detach"
            disabled={mutation.isPending}
            onClick={() => run('detach')}
            type="button"
            variant="outline"
          >
            Открепить цели — они продолжат работать
          </Button>
          <Button
            data-testid="life-goal-delete-trash"
            disabled={mutation.isPending}
            onClick={() => run('trash')}
            type="button"
            variant="destructive"
          >
            Удалить вместе с целями в корзину
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
