import { DEFAULT_LIFE_EXPECTANCY_YEARS, type Tone, type UserDto } from '@dilife/contracts'
import { useEffect, useId, useRef, useState } from 'react'

import { DateField } from '@/components/DateField'
import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  GoalFields,
  parseGoalDraft,
  useCreateGoalMutation,
  useGoalTreeQuery,
  useUpsertLifeGoalMutation,
  type GoalDraftErrors,
} from '@/features/goals'
import { useSettingsQuery, useToday, useUpdateSettingsMutation } from '@/features/settings'
import { TonePicker, toneText } from '@/features/tone'
import { useCompleteOnboardingMutation } from '@/features/users'
import { describeApiError } from '@/platform/api'
import { StagesEditor } from './StagesEditor'
import {
  clearWizardDraft,
  readStages,
  readWizardDraft,
  wizardSteps,
  writeWizardDraft,
  type WizardDraft,
} from './wizard-draft'

const stepTitles = ['Тон обращения', 'Горизонт жизни', 'Дело твоей жизни', 'Первая цель'] as const

/**
 * The first-run wizard (§7 of PRD.md, task 07): tone, life horizon, life goal and the first goal
 * with stages and steps. It cannot be skipped; signing out stays possible. Steps 1–3 are saved
 * as they are left, the goal only with «Готово», and «Назад» keeps everything typed.
 */
export function WizardPage({
  onDone,
  onLogout,
  user,
}: {
  onDone: () => void
  onLogout: () => Promise<void>
  user: UserDto
}) {
  const [draft, setDraftState] = useState<WizardDraft>(() => readWizardDraft(user.id))
  const setDraft = (next: WizardDraft) => {
    setDraftState(next)
    writeWizardDraft(user.id, next)
  }
  const tree = useGoalTreeQuery()
  const complete = useCompleteOnboardingMutation()
  const legacyChecked = useRef(false)

  // An account made before the wizard existed, with a life goal and goals already, has nothing
  // to set up: it is marked done and sent on (task 07).
  useEffect(() => {
    if (legacyChecked.current || !tree.data) return
    legacyChecked.current = true
    if (tree.data.lifeGoal && tree.data.goals.length > 0) {
      complete.mutate(undefined, {
        onSuccess: () => {
          clearWizardDraft(user.id)
          onDone()
        },
      })
    }
  }, [complete, onDone, tree.data, user.id])

  const go = (step: number) => setDraft({ ...draft, step })

  return (
    <main className="flex min-h-svh flex-col items-center bg-background p-4 md:p-8" data-testid="wizard">
      <div className="flex w-full max-w-xl flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <Typography variant="brand">DiLife</Typography>
          <Button data-testid="wizard-logout" onClick={() => void onLogout()} size="sm" type="button" variant="ghost">
            Выйти
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <Typography tone="muted" variant="eyebrow">
            Шаг {draft.step + 1} из {wizardSteps}
          </Typography>
          <Progress aria-label="Сколько шагов пройдено" value={((draft.step + 1) / wizardSteps) * 100} />
        </div>
        <Card>
          <CardHeader>
            <Typography as="h1" variant="h4">
              {stepTitles[draft.step]}
            </Typography>
            <CardDescription>{stepIntro(draft.step)}</CardDescription>
          </CardHeader>
          <CardContent>
            {draft.step === 0 ? <ToneStep onNext={() => go(1)} /> : null}
            {draft.step === 1 ? <HorizonStep onBack={() => go(0)} onNext={() => go(2)} /> : null}
            {draft.step === 2 ? <LifeGoalStep onBack={() => go(1)} onNext={() => go(3)} /> : null}
            {draft.step === 3 ? (
              <FirstGoalStep
                draft={draft}
                onBack={() => go(2)}
                onChange={setDraft}
                onDone={() => {
                  clearWizardDraft(user.id)
                  onDone()
                }}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function stepIntro(step: number) {
  switch (step) {
    case 0:
      return 'Как приложению с тобой говорить? Выбор можно поменять в настройках.'
    case 1:
      return 'Сколько времени впереди. Ожидаемая продолжительность — твоя оценка, её можно менять.'
    case 2:
      return 'То, ради чего ты ставишь цели. Все цели будут жить под ним.'
    default:
      return 'Что ты хочешь сделать, к какому сроку и какими шагами.'
  }
}

function StepButtons({
  busy,
  nextLabel = 'Дальше',
  onBack,
  onNext,
}: {
  busy?: boolean
  nextLabel?: string
  onBack?: () => void
  onNext: () => void
}) {
  return (
    <div className="mt-6 flex justify-between gap-2">
      {onBack ? (
        <Button data-testid="wizard-back" onClick={onBack} type="button" variant="ghost">
          Назад
        </Button>
      ) : (
        <span />
      )}
      <Button data-testid="wizard-next" disabled={busy} onClick={onNext} type="button">
        {nextLabel}
      </Button>
    </div>
  )
}

function ToneStep({ onNext }: { onNext: () => void }) {
  const settings = useSettingsQuery()
  const update = useUpdateSettingsMutation()
  const saved = settings.data?.settings.tone
  const [tone, setTone] = useState<Tone | null>(null)
  const shown = tone ?? saved ?? 'friendly'

  return (
    <>
      <TonePicker onChange={setTone} value={shown} />
      {update.isError ? (
        <Typography tone="destructive" variant="bodySm">
          {describeApiError(update.error, 'Не сохранилось. Попробуй ещё раз.')}
        </Typography>
      ) : null}
      <StepButtons
        busy={update.isPending || !settings.data}
        onNext={() =>
          shown === saved ? onNext() : update.mutate({ tone: shown }, { onSuccess: onNext })
        }
      />
    </>
  )
}

function HorizonStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const birthId = useId()
  const expectancyId = useId()
  const { today } = useToday()
  const settings = useSettingsQuery()
  const update = useUpdateSettingsMutation()
  const [birth, setBirth] = useState<string | null>(null)
  const [expectancy, setExpectancy] = useState<string | null>(null)
  const saved = settings.data?.settings
  const birthValue = birth ?? saved?.birthDate ?? ''
  const expectancyValue =
    expectancy ?? String(saved?.lifeExpectancy ?? DEFAULT_LIFE_EXPECTANCY_YEARS)
  const years = Number(expectancyValue)
  const [error, setError] = useState<string | null>(null)

  const next = () => {
    if (birthValue === '') {
      setError('Укажи дату рождения — без неё горизонт не посчитать.')
      return
    }
    if (!Number.isInteger(years) || years < 1 || years > 150) {
      setError('Продолжительность — целое число лет от 1 до 150.')
      return
    }
    setError(null)
    update.mutate({ birthDate: birthValue, lifeExpectancy: years }, { onSuccess: onNext })
  }

  return (
    <>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={birthId}>Дата рождения</FieldLabel>
          <DateField
            data-testid="wizard-birth"
            id={birthId}
            max={today}
            onChange={setBirth}
            value={birthValue}
            yearRange={{ from: 1920, to: Number(today.slice(0, 4)) }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={expectancyId}>Ожидаемая продолжительность жизни, лет</FieldLabel>
          <Input
            data-testid="wizard-expectancy"
            id={expectancyId}
            inputMode="numeric"
            onChange={(event) => setExpectancy(event.target.value)}
            value={expectancyValue}
          />
          <FieldDescription>По умолчанию 80.</FieldDescription>
        </Field>
      </FieldGroup>
      {saved ? (
        <Typography className="mt-4" tone="muted" variant="bodySm">
          {toneText(saved.tone, 'horizon')}
        </Typography>
      ) : null}
      {error || update.isError ? (
        <Typography tone="destructive" variant="bodySm">
          {error ?? describeApiError(update.error, 'Не сохранилось. Попробуй ещё раз.')}
        </Typography>
      ) : null}
      <StepButtons busy={update.isPending} onBack={onBack} onNext={next} />
    </>
  )
}

function LifeGoalStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const inputId = useId()
  const tree = useGoalTreeQuery()
  const upsert = useUpsertLifeGoalMutation()
  const saved = tree.data?.lifeGoal?.title ?? ''
  const [title, setTitle] = useState<string | null>(null)
  const value = title ?? saved
  const [error, setError] = useState<string | null>(null)

  const next = () => {
    const trimmed = value.trim()
    if (trimmed === '') {
      setError('Назови дело жизни — без него цель завести нельзя.')
      return
    }
    setError(null)
    if (trimmed === saved) {
      onNext()
      return
    }
    upsert.mutate(trimmed, { onSuccess: onNext })
  }

  return (
    <>
      <Field>
        <FieldLabel htmlFor={inputId}>Дело жизни</FieldLabel>
        <Input
          data-testid="wizard-life-goal"
          id={inputId}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Например: быть здоровым и сильным"
          value={value}
        />
      </Field>
      {error || upsert.isError ? (
        <Typography tone="destructive" variant="bodySm">
          {error ?? describeApiError(upsert.error, 'Не сохранилось. Попробуй ещё раз.')}
        </Typography>
      ) : null}
      <StepButtons busy={upsert.isPending || tree.isPending} onBack={onBack} onNext={next} />
    </>
  )
}

function FirstGoalStep({
  draft,
  onBack,
  onChange,
  onDone,
}: {
  draft: WizardDraft
  onBack: () => void
  onChange: (draft: WizardDraft) => void
  onDone: () => void
}) {
  const { today } = useToday()
  const create = useCreateGoalMutation()
  const complete = useCompleteOnboardingMutation()
  const [errors, setErrors] = useState<GoalDraftErrors>({})
  const [stagesError, setStagesError] = useState<string | null>(null)
  const busy = create.isPending || complete.isPending

  const finish = () => {
    const parsed = parseGoalDraft(draft.goal, today)
    const stages = readStages(draft.stages)
    setErrors('errors' in parsed ? parsed.errors : {})
    setStagesError('error' in stages ? stages.error : null)
    if ('errors' in parsed || 'error' in stages) return
    create.mutate(
      {
        ...parsed.goal,
        // The wizard does not ask for it: every goal starts warning three days ahead (task 09).
        deadlineWarningDays: 3,
        stages: stages.stages,
        creationKey: draft.creationKey,
      },
      { onSuccess: () => complete.mutate(undefined, { onSuccess: onDone }) },
    )
  }

  return (
    <>
      <GoalFields
        draft={draft.goal}
        errors={errors}
        onChange={(goal) => onChange({ ...draft, goal })}
        showDescription={false}
        showWarningDays={false}
        today={today}
      />
      <div className="mt-6 flex flex-col gap-2">
        <Typography as="h2" variant="h6">
          Этапы и шаги
        </Typography>
        <StagesEditor onChange={(stages) => onChange({ ...draft, stages })} stages={draft.stages} />
      </div>
      {stagesError || create.isError || complete.isError ? (
        <Typography tone="destructive" variant="bodySm">
          {stagesError ??
            describeApiError(create.error ?? complete.error, 'Не сохранилось. Попробуй ещё раз.')}
        </Typography>
      ) : null}
      <StepButtons busy={busy} nextLabel={busy ? 'Сохраняем…' : 'Готово'} onBack={onBack} onNext={finish} />
    </>
  )
}
