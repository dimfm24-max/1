import type {
  DayTemplateDto,
  DayTemplateItemDto,
  ScheduleRuleDto,
  TaskCategoryDto,
} from '@dilife/contracts'
import { useState } from 'react'
import { toast } from 'sonner'

import { TimeField } from '@/components/TimeField'
import { Typography } from '@/components/typography'
import { WeekdayPicker } from '@/components/WeekdayPicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Toggle } from '@/components/ui/toggle'
import { describeApiError } from '@/platform/api'
import { formatDuration } from '@/platform/intl'
import { describeRepeat } from './day-view'
import {
  useCreateTemplateItemMutation,
  useCreateTemplateMutation,
  useDayContextQuery,
  useDeleteTemplateItemMutation,
  useDeleteTemplateMutation,
  useUpdateTemplateItemMutation,
  useUpdateTemplateMutation,
} from './queries'

const durationChoices = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240] as const
const monthDays = Array.from({ length: 31 }, (_, index) => index + 1)

type RuleKind = 'manual' | 'daily' | 'weekdays' | 'monthdays'

/**
 * «Настройки → Шаблоны дня» (task 17): templates, their items, and when each one applies by
 * itself. A change never touches tasks already added to past days.
 */
export function TemplatesPanel() {
  const context = useDayContextQuery()
  const create = useCreateTemplateMutation()
  const [title, setTitle] = useState('')
  const [deleting, setDeleting] = useState<DayTemplateDto | null>(null)

  if (!context.data) {
    return (
      <Typography tone="muted" variant="bodySm">
        {context.isError ? 'Не удалось загрузить шаблоны. Обнови страницу.' : 'Загружаем…'}
      </Typography>
    )
  }

  const { categories, templates } = context.data

  return (
    <div className="flex flex-col gap-6" data-testid="template-settings">
      <Card>
        <CardHeader>
          <Typography as="h2" variant="h6">
            Шаблоны дня
          </Typography>
          <CardDescription>
            Шаблон — готовый набор задач. Применяй его из «Плана дня» или задай правило, и он
            сам появится в нужные дни, по одному разу на день.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const name = title.trim()
              if (name === '') return
              create.mutate(name, {
                onSuccess: () => {
                  setTitle('')
                  toast(`Шаблон «${name}» создан`)
                },
              })
            }}
          >
            <Input
              aria-label="Название шаблона"
              className="min-w-0 flex-1"
              data-testid="template-new-title"
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: рабочий день"
              value={title}
            />
            <Button data-testid="template-new-submit" disabled={title.trim() === '' || create.isPending} type="submit">
              Создать
            </Button>
          </form>
          {create.isError ? (
            <Typography tone="destructive" variant="caption">
              {describeApiError(create.error, 'Шаблон не создался. Попробуй ещё раз.')}
            </Typography>
          ) : null}
        </CardContent>
      </Card>

      {templates.length === 0 ? (
        <Typography tone="muted" variant="bodySm">
          Шаблонов пока нет.
        </Typography>
      ) : (
        templates.map((template) => (
          <TemplateCard
            categories={categories}
            key={template.id}
            onDelete={() => setDeleting(template)}
            template={template}
          />
        ))
      )}

      <DeleteTemplateDialog onClose={() => setDeleting(null)} template={deleting} />
    </div>
  )
}

function TemplateCard({
  categories,
  onDelete,
  template,
}: {
  categories: ReadonlyArray<TaskCategoryDto>
  onDelete: () => void
  template: DayTemplateDto
}) {
  const update = useUpdateTemplateMutation()
  const addItem = useCreateTemplateItemMutation()
  const [title, setTitle] = useState(template.title)
  const [shownTitle, setShownTitle] = useState(template.title)
  const [itemTitle, setItemTitle] = useState('')
  if (shownTitle !== template.title) {
    setShownTitle(template.title)
    setTitle(template.title)
  }

  const rename = () => {
    const next = title.trim()
    if (next === '' || next === template.title) {
      setTitle(template.title)
      return
    }
    update.mutate({ templateId: template.id, input: { title: next } })
  }

  return (
    <Card data-testid={`template-${template.id}`}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Input
            aria-label="Название шаблона"
            data-testid={`template-title-${template.id}`}
            maxLength={200}
            onBlur={rename}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
            value={title}
          />
          <Button data-testid={`template-delete-${template.id}`} onClick={onDelete} size="sm" type="button" variant="ghost">
            Удалить
          </Button>
        </div>

        <RuleEditor
          onChange={(rule) => update.mutate({ templateId: template.id, input: { rule } })}
          pending={update.isPending}
          rule={template.rule ?? null}
          templateId={template.id}
        />
        {update.isError ? (
          <Typography tone="destructive" variant="caption">
            {describeApiError(update.error, 'Не сохранилось. Попробуй ещё раз.')}
          </Typography>
        ) : null}

        <div className="flex flex-col gap-2">
          <Typography tone="muted" variant="eyebrow">
            Задачи шаблона
          </Typography>
          {template.items.length === 0 ? (
            <Typography tone="muted" variant="bodySm">
              Пока пусто. Добавь первую задачу.
            </Typography>
          ) : (
            <ul className="flex flex-col gap-2">
              {template.items.map((item) => (
                <TemplateItemRow categories={categories} item={item} key={item.id} />
              ))}
            </ul>
          )}
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const name = itemTitle.trim()
              if (name === '') return
              addItem.mutate({ templateId: template.id, title: name }, { onSuccess: () => setItemTitle('') })
            }}
          >
            <Input
              aria-label="Новая задача шаблона"
              className="min-w-0 flex-1"
              data-testid={`template-item-new-${template.id}`}
              maxLength={200}
              onChange={(event) => setItemTitle(event.target.value)}
              placeholder="Новая задача"
              value={itemTitle}
            />
            <Button disabled={itemTitle.trim() === '' || addItem.isPending} type="submit" variant="outline">
              Добавить
            </Button>
          </form>
          {addItem.isError ? (
            <Typography tone="destructive" variant="caption">
              {describeApiError(addItem.error, 'Задача не добавилась. Попробуй ещё раз.')}
            </Typography>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function ruleKind(rule: ScheduleRuleDto | null): RuleKind {
  if (rule === null || rule.kind === 'dates') return 'manual'
  return rule.kind
}

/** Manual, every day, on weekdays or on days of the month. Each change is saved at once. */
function RuleEditor({
  onChange,
  pending,
  rule,
  templateId,
}: {
  onChange: (rule: ScheduleRuleDto | null) => void
  pending: boolean
  rule: ScheduleRuleDto | null
  templateId: string
}) {
  const kind = ruleKind(rule)
  const weekdays = rule?.kind === 'weekdays' ? rule.weekdays : []
  const days = rule?.kind === 'monthdays' ? rule.monthDays : []

  return (
    <div className="flex flex-col gap-2">
      <Field>
        <FieldLabel htmlFor={`template-rule-${templateId}`}>Когда применять</FieldLabel>
        <NativeSelect
          data-testid={`template-rule-${templateId}`}
          disabled={pending}
          id={`template-rule-${templateId}`}
          onChange={(event) => {
            const next = event.target.value as RuleKind
            if (next === 'manual') onChange(null)
            if (next === 'daily') onChange({ kind: 'daily' })
            // A new choice starts with Monday or the 1st, so the rule is never empty.
            if (next === 'weekdays') onChange({ kind: 'weekdays', weekdays: [1] })
            if (next === 'monthdays') onChange({ kind: 'monthdays', monthDays: [1] })
          }}
          value={kind}
        >
          <option value="manual">Вручную</option>
          <option value="daily">Каждый день</option>
          <option value="weekdays">По дням недели</option>
          <option value="monthdays">По числам месяца</option>
        </NativeSelect>
      </Field>
      {kind === 'weekdays' ? (
        <WeekdayPicker
          disabled={pending}
          label="Дни недели"
          onChange={(next) => next.length > 0 && onChange({ kind: 'weekdays', weekdays: next })}
          value={weekdays}
        />
      ) : null}
      {kind === 'monthdays' ? (
        <div aria-label="Числа месяца" className="grid grid-cols-7 gap-1 sm:max-w-sm" role="group">
          {monthDays.map((day) => (
            <Toggle
              aria-label={`${day} число`}
              disabled={pending}
              key={day}
              onPressedChange={(pressed) => {
                const next = pressed
                  ? [...days, day].sort((left, right) => left - right)
                  : days.filter((other) => other !== day)
                if (next.length > 0) onChange({ kind: 'monthdays', monthDays: next })
              }}
              pressed={days.includes(day)}
              size="sm"
              variant="outline"
            >
              {day}
            </Toggle>
          ))}
        </div>
      ) : null}
      {rule !== null && kind !== 'manual' ? (
        <Typography tone="muted" variant="caption">
          Появляется сам {describeRepeat(rule)}
          {kind === 'monthdays' && days.some((day) => day > 28)
            ? '. В коротком месяце 29–31 числа переходят на последний день'
            : ''}
          .
        </Typography>
      ) : null}
    </div>
  )
}

function TemplateItemRow({
  categories,
  item,
}: {
  categories: ReadonlyArray<TaskCategoryDto>
  item: DayTemplateItemDto
}) {
  const update = useUpdateTemplateItemMutation()
  const remove = useDeleteTemplateItemMutation()
  const [title, setTitle] = useState(item.title)
  const [shownTitle, setShownTitle] = useState(item.title)
  if (shownTitle !== item.title) {
    setShownTitle(item.title)
    setTitle(item.title)
  }
  const durations = durationChoices.includes(item.durationMinutes as (typeof durationChoices)[number])
    ? durationChoices
    : [...durationChoices, item.durationMinutes].sort((left, right) => left - right)

  const rename = () => {
    const next = title.trim()
    if (next === '' || next === item.title) {
      setTitle(item.title)
      return
    }
    update.mutate({ itemId: item.id, input: { title: next } })
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3" data-testid={`template-item-${item.id}`}>
      <div className="flex items-center gap-2">
        <Input
          aria-label="Название задачи шаблона"
          maxLength={200}
          onBlur={rename}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          value={title}
        />
        <Button
          data-testid={`template-item-delete-${item.id}`}
          disabled={remove.isPending}
          onClick={() => remove.mutate(item.id)}
          size="sm"
          type="button"
          variant="ghost"
        >
          Убрать
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <TimeField
          aria-label="Время"
          onChange={(startMinute) => update.mutate({ itemId: item.id, input: { startMinute } })}
          placeholder="без времени"
          value={item.startMinute}
        />
        <NativeSelect
          aria-label="Длительность"
          onChange={(event) =>
            update.mutate({ itemId: item.id, input: { durationMinutes: Number(event.target.value) } })
          }
          value={String(item.durationMinutes)}
        >
          {durations.map((minutes) => (
            <option key={minutes} value={minutes}>
              {formatDuration(minutes)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Категория"
          onChange={(event) =>
            update.mutate({ itemId: item.id, input: { categoryId: event.target.value || null } })
          }
          value={item.categoryId ?? ''}
        >
          <option value="">Без категории</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.title}
            </option>
          ))}
        </NativeSelect>
      </div>
      {update.isError || remove.isError ? (
        <Typography tone="destructive" variant="caption">
          {describeApiError(update.error ?? remove.error, 'Не сохранилось. Попробуй ещё раз.')}
        </Typography>
      ) : null}
    </li>
  )
}

function DeleteTemplateDialog({ onClose, template }: { onClose: () => void; template: DayTemplateDto | null }) {
  const remove = useDeleteTemplateMutation()

  return (
    <Dialog onOpenChange={(open) => (open ? undefined : onClose())} open={template !== null}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Удалить шаблон «{template?.title}»?</DialogTitle>
          <DialogDescription>
            Задачи, которые он уже добавил в дни, останутся. Сам он больше не появится.
          </DialogDescription>
        </DialogHeader>
        {remove.isError ? (
          <Typography tone="destructive" variant="caption">
            {describeApiError(remove.error, 'Не удалилось. Попробуй ещё раз.')}
          </Typography>
        ) : null}
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="ghost">
            Отмена
          </Button>
          <Button
            data-testid="template-delete-confirm"
            disabled={remove.isPending}
            onClick={() =>
              template &&
              remove.mutate(template.id, {
                onSuccess: () => {
                  onClose()
                  toast(`Шаблон «${template.title}» удалён`)
                },
              })
            }
            type="button"
            variant="destructive"
          >
            Удалить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
