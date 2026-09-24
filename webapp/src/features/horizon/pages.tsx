import type { Tone } from '@dilife/contracts'
import { useId, useState } from 'react'

import { DateField } from '@/components/DateField'
import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { useSettingsQuery, useToday, useUpdateSettingsMutation } from '@/features/settings'
import { toneText } from '@/features/tone'
import { describeHorizon, formatCount, unitForms } from './horizon'

/**
 * The life horizon. It is part of the product and cannot be switched off, but it speaks in the
 * tone the person chose, so the same numbers can arrive as a push or as a plain statement.
 */
export function HorizonPage() {
  const { today } = useToday()
  const context = useSettingsQuery()

  if (context.isPending) {
    return (
      <section className="flex min-h-48 items-center justify-center" data-testid="horizon-loading">
        <Spinner />
      </section>
    )
  }

  if (context.isError) {
    return (
      <Alert data-testid="horizon-error" variant="destructive">
        <AlertTitle>Не удалось загрузить горизонт</AlertTitle>
        <AlertDescription>Проверь интернет и обнови страницу.</AlertDescription>
      </Alert>
    )
  }

  const { birthDate, lifeExpectancy, tone } = context.data.settings

  return (
    <section className="flex flex-col gap-6 p-4 md:p-6" data-testid="horizon-page">
      <HorizonSettings birthDate={birthDate} lifeExpectancy={lifeExpectancy} today={today} />
      {birthDate === null || lifeExpectancy === null ? (
        <Typography data-testid="horizon-empty" tone="muted" variant="bodySm">
          Укажи дату рождения и ожидаемую продолжительность жизни — и увидишь, сколько
          времени впереди.
        </Typography>
      ) : (
        <HorizonView
          birthDate={birthDate}
          lifeExpectancy={lifeExpectancy}
          today={today}
          tone={tone}
        />
      )}
    </section>
  )
}

function HorizonView({
  birthDate,
  lifeExpectancy,
  today,
  tone,
}: {
  birthDate: string
  lifeExpectancy: number
  today: string
  tone: Tone
}) {
  const horizon = describeHorizon(birthDate, lifeExpectancy, today)

  return (
    <>
      <Card data-testid="horizon-numbers">
        <CardHeader className="gap-2">
          <Typography as="h1" variant="h5">
            Горизонт жизни
          </Typography>
          <CardDescription data-testid="horizon-message">
            {toneText(tone, horizon.isPast ? 'horizonPast' : 'horizon')}
          </CardDescription>
          <Progress aria-label="Прожитая часть" value={horizon.livedPercent} />
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            formatCount(horizon.remainingYears, unitForms.years),
            formatCount(horizon.remainingMonths, unitForms.months),
            formatCount(horizon.remainingWeeks, unitForms.weeks),
            formatCount(horizon.remainingDays, unitForms.days),
          ].map((value) => (
            <Typography key={value} variant="h6">
              {value}
            </Typography>
          ))}
        </CardContent>
      </Card>

      <Card data-testid="horizon-grid">
        <CardHeader>
          <Typography as="h2" variant="h6">
            Недели
          </Typography>
          <CardDescription>
            Каждый квадрат — неделя. Закрашенные уже прожиты: {horizon.livedWeeks} из{' '}
            {horizon.totalWeeks}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WeekGrid livedWeeks={horizon.livedWeeks} totalWeeks={horizon.totalWeeks} />
        </CardContent>
      </Card>
    </>
  )
}

/**
 * One square per week. Rendered as spans rather than thousands of interactive nodes: the grid is
 * a picture, and a person reads it rather than clicking it.
 */
function WeekGrid({ livedWeeks, totalWeeks }: { livedWeeks: number; totalWeeks: number }) {
  return (
    <div className="flex flex-wrap gap-[3px]" role="img" aria-label="Прожитые недели">
      <>
      {Array.from({ length: totalWeeks }, (_, index) => (
        <span
          className={
            index < livedWeeks
              ? 'h-2 w-2 rounded-[2px] bg-primary'
              : 'h-2 w-2 rounded-[2px] bg-muted'
          }
          key={index}
        />
      ))}
      </>
    </div>
  )
}

function HorizonSettings({
  birthDate,
  lifeExpectancy,
  today,
}: {
  birthDate: string | null
  lifeExpectancy: number | null
  today: string
}) {
  const birthId = useId()
  const expectancyId = useId()
  const [birth, setBirth] = useState(birthDate ?? '')
  const [expectancy, setExpectancy] = useState(String(lifeExpectancy ?? 80))
  const mutation = useUpdateSettingsMutation()

  const submit = () => {
    if (birth === '') return
    mutation.mutate({ birthDate: birth, lifeExpectancy: Number(expectancy) })
  }

  return (
    <Card data-testid="horizon-settings">
      <CardHeader>
        <Typography as="h2" variant="h6">
          Твои данные
        </Typography>
        <CardDescription>
          Ожидаемая продолжительность — это твоя оценка, а не прогноз. Её можно менять.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={birthId}>Дата рождения</FieldLabel>
            <DateField
              data-testid="horizon-birth"
              id={birthId}
              max={today}
              onChange={setBirth}
              value={birth}
              yearRange={{ from: 1920, to: Number(today.slice(0, 4)) }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={expectancyId}>Ожидаемая продолжительность, лет</FieldLabel>
            <Input
              data-testid="horizon-expectancy"
              id={expectancyId}
              max={150}
              min={1}
              onChange={(event) => setExpectancy(event.target.value)}
              type="number"
              value={expectancy}
            />
            <FieldDescription>По умолчанию 80.</FieldDescription>
          </Field>
        </FieldGroup>
        <Button
          className="mt-4"
          data-testid="horizon-save"
          disabled={birth === '' || mutation.isPending}
          onClick={submit}
          type="button"
        >
          Сохранить
        </Button>
      </CardContent>
    </Card>
  )
}

/** «Настройки → Горизонт»: the same two numbers as on the horizon screen. */
export function HorizonSettingsPanel() {
  const { today } = useToday()
  const context = useSettingsQuery()

  if (!context.data) {
    return (
      <Typography tone="muted" variant="bodySm">
        {context.isError ? 'Не удалось загрузить настройки. Обнови страницу.' : 'Загружаем…'}
      </Typography>
    )
  }

  const { birthDate, lifeExpectancy } = context.data.settings
  return <HorizonSettings birthDate={birthDate} lifeExpectancy={lifeExpectancy} today={today} />
}
