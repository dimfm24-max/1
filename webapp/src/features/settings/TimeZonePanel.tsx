import { useId, useMemo } from 'react'

import { Typography } from '@/components/typography'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { describeApiError } from '@/platform/api'
import { browserTimeZone, effectiveTimeZone, FALLBACK_TIME_ZONE } from './local-day'
import { useSettingsQuery, useUpdateSettingsMutation } from './queries'
import { matchesTimeZone, timeZoneOptions, type TimeZoneOption } from './time-zones'

/**
 * The time zone in the profile: a list with search. The zone usually follows the browser by
 * itself (`TimeZoneSync`); picking one here is for when the browser is wrong or a trip is short.
 */
export function TimeZonePanel() {
  const settings = useSettingsQuery()
  const mutation = useUpdateSettingsMutation()
  const inputId = useId()
  const saved = settings.data?.settings.timeZone ?? null
  const current = effectiveTimeZone(saved)
  const options = useMemo(
    () => timeZoneOptions([saved, browserTimeZone(), FALLBACK_TIME_ZONE]),
    [saved],
  )
  const selected = options.find((option) => option.zone === current) ?? null

  return (
    <Card data-testid="time-zone-settings">
      <CardHeader>
        <Typography as="h2" variant="h6">
          Часовой пояс
        </Typography>
        <CardDescription>
          По нему считаются день, время задач и напоминания.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor={inputId}>Пояс</FieldLabel>
          <Combobox<TimeZoneOption>
            disabled={!settings.data || mutation.isPending}
            filter={(option, query) => matchesTimeZone(option, query)}
            isItemEqualToValue={(left, right) => left.zone === right.zone}
            itemToStringLabel={(option) => option.label}
            items={options}
            limit={60}
            onValueChange={(option) => {
              if (option && option.zone !== saved) mutation.mutate({ timeZone: option.zone })
            }}
            value={selected}
          >
            <ComboboxInput
              data-testid="time-zone-input"
              id={inputId}
              placeholder="Город или пояс, например Москва"
            />
            <ComboboxContent>
              <ComboboxEmpty>Такого пояса нет в списке.</ComboboxEmpty>
              <ComboboxList>
                {(option: TimeZoneOption) => (
                  <ComboboxItem key={option.zone} value={option}>
                    {option.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <FieldDescription>
            {saved === null
              ? `Пока пояс не выбран, день считается по ${FALLBACK_TIME_ZONE}.`
              : 'Если сменить пояс в браузере, приложение предложит новый само.'}
          </FieldDescription>
        </Field>
        {mutation.isError ? (
          <Typography tone="destructive" variant="bodySm">
            {describeApiError(mutation.error, 'Пояс не сохранился. Попробуй ещё раз.')}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  )
}
