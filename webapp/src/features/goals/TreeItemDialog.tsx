import type { GoalDto } from '@dilife/contracts'
import { useId, useState } from 'react'

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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { describeApiError } from '@/platform/api'
import { pluralForm } from '@/platform/intl'
import {
  useDeleteStageMutation,
  useDeleteStepMutation,
  useUpdateStageMutation,
  useUpdateStepMutation,
} from './queries'

type Stage = GoalDto['stages'][number]
type Step = Stage['steps'][number]

export type TreeItem = { kind: 'stage'; stage: Stage } | { kind: 'step'; step: Step }

/**
 * A stage or a step opened for a closer look: its name, a description without a length limit
 * (§14), a step's time estimate, and deletion. Deleting sends it to the trash; a stage takes its
 * steps along, and the dialog says how many before it happens.
 */
export function TreeItemDialog({
  item,
  onDeleted,
  onOpenChange,
  open,
  readOnly,
}: {
  item: TreeItem
  onDeleted?: (kind: 'stage' | 'step', id: string, label: string) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  readOnly: boolean
}) {
  const id = useId()
  const initial = item.kind === 'stage' ? item.stage : item.step
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description ?? '')
  const [estimate, setEstimate] = useState(
    item.kind === 'step' && item.step.estimatedMinutes !== null
      ? String(item.step.estimatedMinutes)
      : '',
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  const updateStage = useUpdateStageMutation()
  const updateStep = useUpdateStepMutation()
  const deleteStage = useDeleteStageMutation()
  const deleteStep = useDeleteStepMutation()
  const saving = item.kind === 'stage' ? updateStage : updateStep
  const deleting = item.kind === 'stage' ? deleteStage : deleteStep
  const minutes = estimate.trim() === '' ? null : Number(estimate)
  const estimateValid = minutes === null || (Number.isInteger(minutes) && minutes > 0 && minutes <= 1440)
  const valid = title.trim() !== '' && title.trim().length <= 200 && estimateValid
  const stepsInside = item.kind === 'stage' ? item.stage.steps.length : 0

  const save = () => {
    if (!valid) return
    const common = {
      title: title.trim(),
      description: description.trim() === '' ? null : description.trim(),
    }
    const close = { onSuccess: () => onOpenChange(false) }
    if (item.kind === 'stage') updateStage.mutate({ stageId: item.stage.id, input: common }, close)
    else
      updateStep.mutate(
        { stepId: item.step.id, input: { ...common, estimatedMinutes: minutes } },
        close,
      )
  }

  const remove = () => {
    const done = {
      onSuccess: () => {
        onOpenChange(false)
        onDeleted?.(
          item.kind,
          initial.id,
          item.kind === 'stage' ? `Этап «${initial.title}»` : `Шаг «${initial.title}»`,
        )
      },
    }
    if (item.kind === 'stage') deleteStage.mutate(item.stage.id, done)
    else deleteStep.mutate(item.step.id, done)
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90svh] overflow-y-auto" data-testid="tree-item-dialog">
        <DialogHeader>
          <DialogTitle>{item.kind === 'stage' ? 'Этап' : 'Шаг'}</DialogTitle>
          <DialogDescription>
            {readOnly ? 'Цель закрыта: верни её в работу, чтобы менять.' : 'Изменения сохранятся по кнопке.'}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-title`}>Название</FieldLabel>
            <Input
              data-testid="tree-item-title"
              disabled={readOnly}
              id={`${id}-title`}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-description`}>Описание</FieldLabel>
            <Textarea
              data-testid="tree-item-description"
              disabled={readOnly}
              id={`${id}-description`}
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </Field>
          {item.kind === 'step' ? (
            <Field>
              <FieldLabel htmlFor={`${id}-estimate`}>Сколько займёт, минут</FieldLabel>
              <Input
                aria-invalid={!estimateValid}
                data-testid="tree-item-estimate"
                disabled={readOnly}
                id={`${id}-estimate`}
                inputMode="numeric"
                onChange={(event) => setEstimate(event.target.value)}
                placeholder="Необязательно"
                value={estimate}
              />
              <FieldDescription>Оценка поможет поставить шаг в план дня.</FieldDescription>
            </Field>
          ) : null}
        </FieldGroup>

        {confirmDelete ? (
          <Typography data-testid="tree-item-delete-warning" tone="destructive" variant="bodySm">
            {item.kind === 'stage'
              ? stepsInside > 0
                ? `Вместе с этапом в корзину уйдут ${stepsInside} ${pluralForm(stepsInside, ['шаг', 'шага', 'шагов'])}. Их можно будет восстановить 30 дней.`
                : 'Этап уйдёт в корзину. Его можно будет восстановить 30 дней.'
              : 'Шаг уйдёт в корзину. Задачи дня с этим шагом останутся в плане.'}
          </Typography>
        ) : null}
        {saving.isError || deleting.isError ? (
          <Typography tone="destructive" variant="bodySm">
            {describeApiError(saving.error ?? deleting.error, 'Не получилось. Попробуй ещё раз.')}
          </Typography>
        ) : null}

        {readOnly ? null : (
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              data-testid={confirmDelete ? 'tree-item-delete-confirm' : 'tree-item-delete'}
              disabled={deleting.isPending}
              onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}
              type="button"
              variant={confirmDelete ? 'destructive' : 'ghost'}
            >
              {confirmDelete ? 'Да, удалить' : 'Удалить'}
            </Button>
            <Button
              data-testid="tree-item-save"
              disabled={!valid || saving.isPending}
              onClick={save}
              type="button"
            >
              Сохранить
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
