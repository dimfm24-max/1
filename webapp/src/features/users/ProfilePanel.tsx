import type { UserDto } from '@dilife/contracts'
import { useId, useState, type FormEvent } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/typography'
import { errorId, hasErrors } from '@/features/auth'
import { describeApiError } from '@/platform/api'
import { validateProfileForm } from './profile-form'
import { useUpdateProfileMutation } from './queries'

export function ProfilePanel({ user }: { user: UserDto }) {
  const displayNameErrorId = useId()
  const [displayName, setDisplayName] = useState(user.displayName ?? '')
  const mutation = useUpdateProfileMutation()
  const validation = validateProfileForm(displayName)
  const displayNameErrors = validation.errors?.fieldErrors.displayName
  const displayNameInvalid = hasErrors(displayNameErrors)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validation.request) return
    mutation.mutate(validation.request.displayName, {
      onSuccess: (response) => setDisplayName(response.user.displayName ?? ''),
    })
  }

  return (
    <Card>
      <CardHeader>
        <Typography as="h2" variant="h6">
          Имя и почта
        </Typography>
        <CardDescription>
          Так приложение будет к тебе обращаться.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" noValidate onSubmit={submit}>
          <FieldGroup>
            <Field data-invalid={displayNameInvalid}>
              <FieldLabel htmlFor="profile-display-name">Имя</FieldLabel>
              <Input
                aria-describedby={errorId(displayNameErrors, displayNameErrorId)}
                aria-invalid={displayNameInvalid}
                autoComplete="name"
                disabled={mutation.isPending}
                data-testid="profile-display-name"
                id="profile-display-name"
                onChange={(event) => {
                  setDisplayName(event.target.value)
                  mutation.reset()
                }}
                placeholder="Как к тебе обращаться"
                value={displayName}
              />
              <FieldDescription>Если оставить пустым, вместо имени будет почта.</FieldDescription>
              <FieldError id={displayNameErrorId} errors={displayNameErrors} />
            </Field>
            <Field>
              <FieldLabel htmlFor="profile-email">Почта</FieldLabel>
              <Input
                aria-readonly="true"
                data-testid="profile-email"
                id="profile-email"
                readOnly
                value={user.email}
              />
              <FieldDescription>Почту сменить нельзя.</FieldDescription>
            </Field>
          </FieldGroup>

          {validation.errors?.formError && (
            <Alert variant="destructive">
              <AlertTitle>Не получается сохранить</AlertTitle>
              <AlertDescription>{validation.errors.formError}</AlertDescription>
            </Alert>
          )}
          {mutation.isError && (
            <Alert variant="destructive">
              <AlertTitle>Не сохранилось</AlertTitle>
              <AlertDescription>
                {describeApiError(mutation.error, 'Попробуй ещё раз.')}
              </AlertDescription>
            </Alert>
          )}
          {mutation.isSuccess && (
            <Alert data-testid="profile-saved">
              <AlertTitle>Сохранено</AlertTitle>
              <AlertDescription>Имя обновлено.</AlertDescription>
            </Alert>
          )}

          <div>
            <Button
              data-testid="profile-save"
              disabled={mutation.isPending || validation.errors !== null}
              type="submit"
            >
              {mutation.isPending ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
