import { useForm } from '@tanstack/react-form'
import { Link } from '@tanstack/react-router'
import { registerRequestSchema, type RegisterRequest } from '@dilife/contracts'
import { useId, useState } from 'react'

import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { describeApiError } from '@/platform/api'
import { useAuth } from '../use-auth'
import { FormAlert } from './form-errors'
import type { FieldErrors } from './form-model'
import {
  clearFieldError,
  errorId,
  hasErrors,
  passwordConfirmationErrors,
  toValidationErrors,
} from './form-validation'
import { PasswordInput } from './PasswordInput'

export function RegisterForm({ returnTo }: { returnTo?: string }) {
  const auth = useAuth()
  const displayNameId = useId()
  const displayNameErrorId = useId()
  const emailId = useId()
  const emailErrorId = useId()
  const passwordId = useId()
  const passwordDescriptionId = useId()
  const passwordErrorId = useId()
  const confirmPasswordId = useId()
  const confirmPasswordErrorId = useId()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
    onSubmit: async ({ value }) => {
      setFormError(null)
      const result = registerRequestSchema.safeParse({
        displayName: value.displayName,
        email: value.email,
        password: value.password,
      })
      const validation = toValidationErrors(result.success ? [] : result.error.issues)
      const nextErrors = validation.fieldErrors
      const confirmationErrors = passwordConfirmationErrors(
        value.password,
        value.confirmPassword,
      )
      if (confirmationErrors) nextErrors.confirmPassword = confirmationErrors
      if (!result.success || hasErrors(nextErrors.confirmPassword)) {
        setFieldErrors(nextErrors)
        setFormError(validation.formError)
        return
      }

      setFieldErrors({})
      try {
        await auth.register(result.data as RegisterRequest)
      } catch (caughtError) {
        setFormError(
          describeApiError(caughtError, 'Зарегистрироваться не получилось. Попробуй ещё раз.'),
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
      <FieldGroup className="gap-5">
        <div className="flex flex-col items-center gap-1 text-center">
          <Typography as="h1" variant="h3" balance>
            Регистрация в DiLife
          </Typography>
          <Typography variant="bodySm" tone="muted" balance>
            Заполни поля — и начнём
          </Typography>
        </div>

        <form.Field name="displayName" children={(field) => (
          <Field data-invalid={hasErrors(fieldErrors.displayName)}>
            <FieldLabel htmlFor={displayNameId}>Имя</FieldLabel>
            <Input
              aria-describedby={errorId(fieldErrors.displayName, displayNameErrorId)}
              aria-invalid={hasErrors(fieldErrors.displayName)}
              autoComplete="name"
              className="bg-background"
              data-testid="signup-display-name"
              id={displayNameId}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => {
                field.handleChange(event.target.value)
                clearFieldError('displayName', setFieldErrors)
                setFormError(null)
              }}
              placeholder="Как к тебе обращаться"
              type="text"
              value={field.state.value}
            />
            <FieldError id={displayNameErrorId} errors={fieldErrors.displayName} />
          </Field>
        )} />

        <form.Field name="email" children={(field) => (
          <Field data-invalid={hasErrors(fieldErrors.email)}>
            <FieldLabel htmlFor={emailId}>Почта</FieldLabel>
            <Input
              aria-describedby={errorId(fieldErrors.email, emailErrorId)}
              aria-invalid={hasErrors(fieldErrors.email)}
              autoComplete="email"
              className="bg-background"
              data-testid="signup-email"
              id={emailId}
              inputMode="email"
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => {
                field.handleChange(event.target.value)
                clearFieldError('email', setFieldErrors)
                setFormError(null)
              }}
              placeholder="name@example.com"
              type="email"
              value={field.state.value}
            />
            <FieldDescription>На неё придёт письмо для подтверждения.</FieldDescription>
            <FieldError id={emailErrorId} errors={fieldErrors.email} />
          </Field>
        )} />

        <form.Field name="password" children={(field) => (
          <Field data-invalid={hasErrors(fieldErrors.password)}>
            <FieldLabel htmlFor={passwordId}>Пароль</FieldLabel>
            <PasswordInput
              aria-describedby={[
                passwordDescriptionId,
                errorId(fieldErrors.password, passwordErrorId),
              ].filter(Boolean).join(' ')}
              aria-invalid={hasErrors(fieldErrors.password)}
              autoComplete="new-password"
              className="bg-background"
              data-testid="signup-password"
              id={passwordId}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => {
                field.handleChange(event.target.value)
                clearFieldError('password', setFieldErrors)
                clearFieldError('confirmPassword', setFieldErrors)
                setFormError(null)
              }}
              toggleTestId="signup-password-toggle"
              value={field.state.value}
            />
            <FieldDescription id={passwordDescriptionId}>
              Не короче 8 знаков.
            </FieldDescription>
            <FieldError id={passwordErrorId} errors={fieldErrors.password} />
          </Field>
        )} />

        <form.Field name="confirmPassword" children={(field) => (
          <Field data-invalid={hasErrors(fieldErrors.confirmPassword)}>
            <FieldLabel htmlFor={confirmPasswordId}>Пароль ещё раз</FieldLabel>
            <PasswordInput
              aria-describedby={errorId(fieldErrors.confirmPassword, confirmPasswordErrorId)}
              aria-invalid={hasErrors(fieldErrors.confirmPassword)}
              autoComplete="new-password"
              className="bg-background"
              data-testid="signup-confirm-password"
              id={confirmPasswordId}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => {
                field.handleChange(event.target.value)
                clearFieldError('confirmPassword', setFieldErrors)
                setFormError(null)
              }}
              value={field.state.value}
              visibilityLabel="повтор пароля"
            />
            <FieldDescription>Чтобы не ошибиться при вводе.</FieldDescription>
            <FieldError id={confirmPasswordErrorId} errors={fieldErrors.confirmPassword} />
          </Field>
        )} />

        <FormAlert message={formError} />

        <Field>
          <form.Subscribe selector={(state) => state.isSubmitting} children={(isSubmitting) => (
            <Button data-testid="signup-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Создаём аккаунт…' : 'Создать аккаунт'}
            </Button>
          )} />
        </Field>

        <FieldDescription className="text-center">
          Уже есть аккаунт?{' '}
          <Link search={{ returnTo }} to="/login">
            Войти
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  )
}
