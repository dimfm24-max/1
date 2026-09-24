import type { GoalDto } from '@dilife/contracts'
import { useState } from 'react'

import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { describeApiError } from '@/platform/api'
import {
  draftFromGoal,
  emptyGoalDraft,
  parseGoalDraft,
  type GoalDraft,
  type GoalDraftErrors,
} from './goal-draft'
import { GoalFields } from './GoalFields'
import { useCreateGoalMutation, useUpdateGoalMutation } from './queries'

/**
 * Creating a goal and changing one are the same form. Switching an automatic goal to manual keeps
 * the last counted number; the other way the steps take over and the number is recounted, so the
 * form says so before saving (task 08).
 */
export function GoalFormDialog({
  goal,
  onOpenChange,
  open,
  today,
}: {
  /** The goal being changed; none to create a new one. */
  goal?: GoalDto
  onOpenChange: (open: boolean) => void
  open: boolean
  today: string
}) {
  const [draft, setDraft] = useState<GoalDraft>(() => (goal ? draftFromGoal(goal) : emptyGoalDraft()))
  const [errors, setErrors] = useState<GoalDraftErrors>({})
  const [creationKey, setCreationKey] = useState(() => crypto.randomUUID())
  const create = useCreateGoalMutation()
  const update = useUpdateGoalMutation()
  const mutation = goal ? update : create
  const switchesToAutomatic =
    goal !== undefined && goal.progressMode === 'manual' && draft.progressMode === 'automatic'

  const reset = () => {
    setDraft(goal ? draftFromGoal(goal) : emptyGoalDraft())
    setErrors({})
    setCreationKey(crypto.randomUUID())
    create.reset()
    update.reset()
  }

  const submit = () => {
    const parsed = parseGoalDraft(draft, today, { deadlineUnchanged: goal?.deadline.slice(0, 10) })
    if ('errors' in parsed) {
      setErrors(parsed.errors)
      return
    }
    setErrors({})
    const done = () => {
      onOpenChange(false)
      reset()
    }
    if (goal) {
      update.mutate(
        {
          goalId: goal.id,
          input: {
            title: parsed.goal.title,
            description: parsed.goal.description,
            deadline: parsed.goal.deadline,
            measureUnit: parsed.goal.measureUnit,
            progressMode: parsed.goal.progressMode,
            targetValue: parsed.goal.targetValue,
            initialValue: parsed.goal.initialValue,
            deadlineWarningDays: parsed.goal.deadlineWarningDays,
          },
        },
        { onSuccess: done },
      )
      return
    }
    create.mutate({ ...parsed.goal, creationKey }, { onSuccess: done })
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
      open={open}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg" data-testid="goal-form-dialog">
        <DialogHeader>
          <DialogTitle>{goal ? 'Изменить цель' : 'Новая цель'}</DialogTitle>
          <DialogDescription>
            {goal
              ? 'Изменения сохранятся сразу для всей цели.'
              : 'Большая цель делится на этапы, этапы — на шаги.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <GoalFields draft={draft} errors={errors} onChange={setDraft} today={today} />
          {switchesToAutomatic ? (
            <Typography data-testid="goal-mode-warning" tone="muted" variant="bodySm">
              Число будет считаться по выполненным шагам и заменит записанное вручную.
            </Typography>
          ) : null}
          {mutation.isError ? (
            <Typography tone="destructive" variant="bodySm">
              {describeApiError(mutation.error, 'Цель не сохранилась. Попробуй ещё раз.')}
            </Typography>
          ) : null}
          <DialogFooter>
            <Button data-testid="goal-submit" disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Сохраняем…' : goal ? 'Сохранить' : 'Создать цель'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
