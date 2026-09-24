import { useId, useState } from 'react'

import { TimeField } from '@/components/TimeField'
import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { describeApiError } from '@/platform/api'
import { formatDuration, formatMinuteOfDay } from '@/platform/intl'
import { useSettingsQuery, useUpdateSettingsMutation } from './queries'

const durationChoices = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240] as const

/**
 * «Настройки → День»: when the day starts and how long a new task lasts. Each value is saved at
 * once. Moving the day start changes which day the small hours belong to, so the change asks
 * first (task 02): tasks planned for 01:00 would suddenly read as yesterday's or today's.
 */
export function DaySettingsPanel() {
  const settings = useSettingsQuery()
  const mutation = useUpdateSettingsMutation()
  const dayStartId = useId()
  const durationId = useId()
  const [pendingStart, setPendingStart] = useState<number | null>(null)

  if (!settings.data) {
    return (
      <Typography tone="muted" variant="bodySm">
        {settings.isError ? 'Не удалось загрузить настройки. Обнови страницу.' : 'Загружаем…'}
      </Typography>
    )
  }

  const { dayStartMinute, defaultTaskMinutes } = settings.data.settings
  const durations = durationChoices.includes(defaultTaskMinutes as (typeof durationChoices)[number])
    ? durationChoices
    : [...durationChoices, defaultTaskMinutes].sort((left, right) => left - right)

  return (
    <Card data-testid="day-settings">
      <CardHeader>
        <Typography as="h2" variant="h6">
          День
        </Typography>
        <CardDescription>
          Если ложишься после полуночи, сдвинь начало дня: ночные дела останутся в сегодняшнем
          плане.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={dayStartId}>Начало дня</FieldLabel>
            <TimeField
              data-testid="day-settings-start"
              id={dayStartId}
              onChange={(value) => {
                if (value === null || value === dayStartMinute) {
                  setPendingStart(null)
                  return
                }
                setPendingStart(value)
              }}
              value={pendingStart ?? dayStartMinute}
            />
            <FieldDescription>
              Сейчас день начинается в {formatMinuteOfDay(dayStartMinute)}. По умолчанию — в 00:00.
            </FieldDescription>
          </Field>

          {pendingStart !== null ? (
            <Alert data-testid="day-settings-start-warning">
              <AlertTitle>Начать день в {formatMinuteOfDay(pendingStart)}?</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-3">
                <Typography as="p" tone="current" variant="bodySm">
                  Задачи между 00:00 и {formatMinuteOfDay(Math.max(dayStartMinute, pendingStart))}{' '}
                  перейдут в соседний день плана. Сами задачи не изменятся.
                </Typography>
                <div className="flex flex-wrap gap-2">
                  <Button
                    data-testid="day-settings-start-confirm"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate(
                        { dayStartMinute: pendingStart },
                        { onSuccess: () => setPendingStart(null) },
                      )
                    }
                    size="sm"
                  >
                    Сменить начало дня
                  </Button>
                  <Button onClick={() => setPendingStart(null)} size="sm" variant="ghost">
                    Оставить как было
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          <Field>
            <FieldLabel htmlFor={durationId}>Длительность новой задачи</FieldLabel>
            <Select
              disabled={mutation.isPending}
              onValueChange={(value) => mutation.mutate({ defaultTaskMinutes: Number(value) })}
              value={String(defaultTaskMinutes)}
            >
              <SelectTrigger data-testid="day-settings-duration" id={durationId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {durations.map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {formatDuration(minutes)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              Для задач без своей длительности. Уже созданные задачи не меняются.
            </FieldDescription>
          </Field>
        </FieldGroup>

        {mutation.isError ? (
          <Typography tone="destructive" variant="bodySm">
            {describeApiError(mutation.error, 'Не сохранилось. Попробуй ещё раз.')}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  )
}
