import { useForm } from '@tanstack/react-form'
import { Link } from '@tanstack/react-router'
import { passwordResetRequestSchema } from '@dilife/contracts'
import { useId, useState } from 'react'

import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { describeApiError } from '@/platform/api'
import { useAuth } from '../use-auth'
import { FormAlert } from './form-errors'
import type { FieldErrors } from './form-model'
import { clearFieldError, errorId, hasErrors, toValidationErrors } from './form-validation'

export function ForgotPasswordForm() {
  const auth = useAuth()
  const emailId = useId()
  const emailErrorId = useId()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)
  const form = useForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      setFormError(null)
      const result = passwordResetRequestSchema.safeParse(value)
      if (!result.success) {
        const validation = toValidationErrors(result.error.issues)
        setFieldErrors(validation.fieldErrors)
        setFormError(validation.formError)
        return
      }

      setFieldErrors({})
      try {
        await auth.requestPasswordReset(result.data)
        setAccepted(true)
      } catch (caughtError) {
        setFormError(
          describeApiError(caughtError, 'Не получилось отправить письмо. Попробуй ещё раз.'),
        )
      }
    },
  })

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <Typography as="h1" variant="h3" balance>
            Восстановление пароля
          </Typography>
          <Typography variant="bodySm" tone="muted" balance>
            Введи почту. Если аккаунт с ней есть, пришлём ссылку для нового пароля
          </Typography>
        </div>

        <form.Field name="email" children={(field) => (
          <Field data-invalid={hasErrors(fieldErrors.email)}>
            <FieldLabel htmlFor={emailId}>Почта</FieldLabel>
            <Input
              aria-describedby={errorId(fieldErrors.email, emailErrorId)}
              aria-invalid={hasErrors(fieldErrors.email)}
              autoComplete="email"
              className="bg-background"
              data-testid="forgot-email"
              id={emailId}
              inputMode="email"
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => {
                field.handleChange(event.target.value)
                clearFieldError('email', setFieldErrors)
                setFormError(null)
                setAccepted(false)
              }}
              placeholder="name@example.com"
              type="email"
              value={field.state.value}
            />
            <FieldError id={emailErrorId} errors={fieldErrors.email} />
          </Field>
        )} />

        {accepted ? (
          <Alert data-testid="forgot-accepted">
            <AlertTitle>Проверь почту</AlertTitle>
            <AlertDescription>
              Если аккаунт с этим адресом есть, письмо уже в пути.
            </AlertDescription>
          </Alert>
        ) : null}
        <FormAlert message={formError} title="Не получилось" />

        <Field>
          <form.Subscribe selector={(state) => state.isSubmitting} children={(isSubmitting) => (
            <Button data-testid="forgot-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Отправляем…' : 'Прислать ссылку'}
            </Button>
          )} />
        </Field>

        <Typography align="center" variant="bodySm">
          <Link className="underline underline-offset-4" search={{ returnTo: undefined }} to="/login">
            Вернуться ко входу
          </Link>
        </Typography>
      </FieldGroup>
    </form>
  )
}
