import { useId } from 'react'

import { DateField } from '@/components/DateField'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import type { GoalDraft, GoalDraftErrors } from './goal-draft'

/**
 * The fields of a goal, shared by the create and edit dialogs and the first-run wizard. The
 * deadline is picked in a calendar and cannot be in the past (task 09).
 */
export function GoalFields({
  draft,
  errors,
  onChange,
  showDescription = true,
  showWarningDays = true,
  today,
}: {
  draft: GoalDraft
  errors: GoalDraftErrors
  onChange: (draft: GoalDraft) => void
  showDescription?: boolean
  /** The wizard sets the warning to its default without asking (task 09). */
  showWarningDays?: boolean
  today: string
}) {
  const id = useId()
  const set = <Key extends keyof GoalDraft>(key: Key, value: GoalDraft[Key]) =>
    onChange({ ...draft, [key]: value })
  const field = (name: string) => `${id}-${name}`

  return (
    <FieldGroup>
      <Field data-invalid={errors.title !== undefined}>
        <FieldLabel htmlFor={field('title')}>Цель</FieldLabel>
        <Input
          aria-invalid={errors.title !== undefined}
          data-testid="goal-title"
          id={field('title')}
          maxLength={200}
          onChange={(event) => set('title', event.target.value)}
          placeholder="Например: пробежать марафон"
          value={draft.title}
        />
        <FieldError errors={errors.title ? [{ message: errors.title }] : undefined} />
      </Field>

      {showDescription ? (
        <Field>
          <FieldLabel htmlFor={field('description')}>Описание</FieldLabel>
          <Textarea
            data-testid="goal-description"
            id={field('description')}
            onChange={(event) => set('description', event.target.value)}
            placeholder="Зачем тебе эта цель и как поймёшь, что дошёл"
            value={draft.description}
          />
        </Field>
      ) : null}

      <Field data-invalid={errors.deadline !== undefined}>
        <FieldLabel htmlFor={field('deadline')}>Срок</FieldLabel>
        <DateField
          aria-invalid={errors.deadline !== undefined}
          data-testid="goal-deadline"
          id={field('deadline')}
          min={today}
          onChange={(value) => set('deadline', value)}
          value={draft.deadline}
        />
        <FieldError errors={errors.deadline ? [{ message: errors.deadline }] : undefined} />
      </Field>

      <Field>
        <FieldLabel>Как считать продвижение</FieldLabel>
        <RadioGroup
          aria-label="Как считать продвижение"
          onValueChange={(value) =>
            set('progressMode', value === 'manual' ? 'manual' : 'automatic')
          }
          value={draft.progressMode}
        >
          <FieldLabel htmlFor={field('automatic')}>
            <Field orientation="horizontal">
              <RadioGroupItem data-testid="goal-mode-automatic" id={field('automatic')} value="automatic" />
              <FieldDescription>По выполненным шагам — само</FieldDescription>
            </Field>
          </FieldLabel>
          <FieldLabel htmlFor={field('manual')}>
            <Field orientation="horizontal">
              <RadioGroupItem data-testid="goal-mode-manual" id={field('manual')} value="manual" />
              <FieldDescription>Записываю число сам: вес, страницы, сумма</FieldDescription>
            </Field>
          </FieldLabel>
        </RadioGroup>
      </Field>

      <Field data-invalid={errors.measureUnit !== undefined}>
        <FieldLabel htmlFor={field('measureUnit')}>В чём измеряешь</FieldLabel>
        <Input
          aria-invalid={errors.measureUnit !== undefined}
          data-testid="goal-unit"
          id={field('measureUnit')}
          maxLength={40}
          onChange={(event) => set('measureUnit', event.target.value)}
          placeholder="километров, страниц, килограммов"
          value={draft.measureUnit}
        />
        <FieldError errors={errors.measureUnit ? [{ message: errors.measureUnit }] : undefined} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        {draft.progressMode === 'manual' ? (
          <Field data-invalid={errors.initialValue !== undefined}>
            <FieldLabel htmlFor={field('initialValue')}>Сколько сейчас</FieldLabel>
            <Input
              aria-invalid={errors.initialValue !== undefined}
              data-testid="goal-initial"
              id={field('initialValue')}
              inputMode="decimal"
              onChange={(event) => set('initialValue', event.target.value)}
              placeholder="0"
              value={draft.initialValue}
            />
            <FieldDescription>Например, вес сегодня. Можно оставить пустым.</FieldDescription>
            <FieldError errors={errors.initialValue ? [{ message: errors.initialValue }] : undefined} />
          </Field>
        ) : null}
        <Field data-invalid={errors.targetValue !== undefined}>
          <FieldLabel htmlFor={field('targetValue')}>Сколько нужно</FieldLabel>
          <Input
            aria-invalid={errors.targetValue !== undefined}
            data-testid="goal-target"
            id={field('targetValue')}
            inputMode="decimal"
            onChange={(event) => set('targetValue', event.target.value)}
            value={draft.targetValue}
          />
          <FieldError errors={errors.targetValue ? [{ message: errors.targetValue }] : undefined} />
        </Field>
      </div>

      {showWarningDays ? (
        <Field data-invalid={errors.deadlineWarningDays !== undefined}>
          <FieldLabel htmlFor={field('deadlineWarningDays')}>Предупреждать о сроке за, дней</FieldLabel>
          <Input
            aria-invalid={errors.deadlineWarningDays !== undefined}
            data-testid="goal-warning-days"
            id={field('deadlineWarningDays')}
            inputMode="numeric"
            onChange={(event) => set('deadlineWarningDays', event.target.value)}
            value={draft.deadlineWarningDays}
          />
          <FieldError
            errors={errors.deadlineWarningDays ? [{ message: errors.deadlineWarningDays }] : undefined}
          />
        </Field>
      ) : null}
    </FieldGroup>
  )
}
