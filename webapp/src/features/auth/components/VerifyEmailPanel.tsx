import { Link } from '@tanstack/react-router'
import { emailVerificationConfirmRequestSchema } from '@dilife/contracts'
import { useEffect, useRef, useState } from 'react'

import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { describeApiError } from '@/platform/api'
import { useAuth } from '../use-auth'
import { FormAlert } from './form-errors'

type VerifyState = 'checking' | 'verified' | 'failed'

const brokenLink = 'Ссылка неполная или неверная. Отправь письмо ещё раз из приложения.'

/**
 * The page the confirmation letter opens. It spends the token by itself: there is nothing to
 * type, and the link has to work on a phone where the person never signed in.
 */
export function VerifyEmailPanel({ token }: { token: string }) {
  const auth = useAuth()
  const tokenIsValid = emailVerificationConfirmRequestSchema.shape.token.safeParse(token).success
  const [state, setState] = useState<VerifyState>(tokenIsValid ? 'checking' : 'failed')
  const [error, setError] = useState<string | null>(tokenIsValid ? null : brokenLink)
  const sentFor = useRef<string | null>(null)
  const { confirmEmailVerification } = auth

  useEffect(() => {
    if (!tokenIsValid || sentFor.current === token) return
    sentFor.current = token
    setState('checking')
    setError(null)
    confirmEmailVerification(token)
      .then(() => setState('verified'))
      .catch((caughtError: unknown) => {
        setState('failed')
        setError(describeApiError(caughtError, 'Не получилось подтвердить почту. Попробуй ещё раз.'))
      })
  }, [confirmEmailVerification, token, tokenIsValid])

  return (
    <div className="flex flex-col gap-6" data-testid="verify-email">
      <div className="flex flex-col items-center gap-1 text-center">
        <Typography as="h1" variant="h3" balance>
          Подтверждение почты
        </Typography>
      </div>

      {state === 'checking' ? (
        <Typography align="center" tone="muted" variant="bodySm">
          Проверяем ссылку…
        </Typography>
      ) : null}

      {state === 'verified' ? (
        <Alert data-testid="verify-email-done">
          <AlertTitle>Почта подтверждена</AlertTitle>
          <AlertDescription>Спасибо! Теперь тебе доступно всё в DiLife.</AlertDescription>
        </Alert>
      ) : null}

      <FormAlert message={error} title="Почта не подтверждена" />

      <Button asChild variant={state === 'verified' ? 'default' : 'outline'}>
        {auth.user ? (
          <Link to="/app">Открыть DiLife</Link>
        ) : (
          <Link search={{ returnTo: undefined }} to="/login">
            Войти
          </Link>
        )}
      </Button>
    </div>
  )
}
