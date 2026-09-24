import { tones, type Tone } from '@dilife/contracts'

import { Typography } from '@/components/typography'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useSettingsQuery, useUpdateSettingsMutation } from '@/features/settings'
import { describeApiError } from '@/platform/api'
import { toneNames, toneText } from './catalog'

/**
 * The four tones, each with a sample line in its own voice, so the choice is heard rather than
 * guessed from a name. Shared by «Настройки → Тон» and the first-run wizard.
 */
export function TonePicker({
  disabled,
  onChange,
  value,
}: {
  disabled?: boolean
  onChange: (tone: Tone) => void
  value: Tone
}) {
  return (
    <RadioGroup
      aria-label="Тон обращения"
      disabled={disabled}
      onValueChange={(next) => {
        const tone = tones.find((item) => item === next)
        if (tone) onChange(tone)
      }}
      value={value}
    >
      {tones.map((tone) => (
        <FieldLabel htmlFor={`tone-${tone}`} key={tone}>
          <Field orientation="horizontal">
            <RadioGroupItem data-testid={`tone-${tone}`} id={`tone-${tone}`} value={tone} />
            <FieldContent>
              <FieldTitle>{toneNames[tone]}</FieldTitle>
              <FieldDescription>«{toneText(tone, 'todayLine')}»</FieldDescription>
            </FieldContent>
          </Field>
        </FieldLabel>
      ))}
    </RadioGroup>
  )
}

/** «Настройки → Тон»: the choice is saved at once and every screen speaks in it without reload. */
export function ToneSettingsPanel() {
  const settings = useSettingsQuery()
  const mutation = useUpdateSettingsMutation()
  const tone = mutation.isPending
    ? (mutation.variables.tone ?? settings.data?.settings.tone)
    : settings.data?.settings.tone

  return (
    <Card data-testid="tone-settings">
      <CardHeader>
        <Typography as="h2" variant="h6">
          Тон обращения
        </Typography>
        <CardDescription>
          Так приложение говорит с тобой везде: на экранах, в уведомлениях и на горизонте жизни.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {tone ? (
          <TonePicker
            disabled={mutation.isPending}
            onChange={(next) => mutation.mutate({ tone: next })}
            value={tone}
          />
        ) : (
          <Typography tone="muted" variant="bodySm">
            {settings.isError ? 'Не удалось загрузить настройки. Обнови страницу.' : 'Загружаем…'}
          </Typography>
        )}
        {mutation.isError ? (
          <Typography tone="destructive" variant="bodySm">
            {describeApiError(mutation.error, 'Тон не сохранился. Попробуй ещё раз.')}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  )
}
