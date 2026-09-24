import type { UserDto } from '@dilife/contracts'
import { useState } from 'react'

import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { describeApiError } from '@/platform/api'
import { useAuth } from '../use-auth'

type SendState = 'idle' | 'sending' | 'sent'

/**
 * «Подтверди почту» over the workspace while the address is unproven. The app works without it;
 * only the link for others and the data export wait (owner's decision on task 05).
 */
export function EmailVerificationBanner({ user }: { user: UserDto }) {
  const auth = useAuth()
  const [state, setState] = useState<SendState>('idle')
  const [error, setError] = useState<string | null>(null)

  if (user.emailVerified) return null

  const send = async () => {
    setState('sending')
    setError(null)
    try {
      await auth.requestEmailVerification()
      setState('sent')
    } catch (caughtError) {
      setState('idle')
      setError(describeApiError(caughtError, 'Письмо не отправилось. Попробуй ещё раз чуть позже.'))
    }
  }

  return (
    <div className="px-4 pt-4 md:px-8">
      <Alert data-testid="email-verification-banner">
        <AlertTitle>Подтверди почту</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <Typography as="p" tone="current" variant="bodySm">
            Мы отправили письмо со ссылкой на {user.email}. Без подтверждения не получится открыть
            доступ по ссылке и выгрузить данные. Остальное работает уже сейчас.
          </Typography>
          {state === 'sent' ? (
            <Typography as="p" data-testid="email-verification-sent" tone="current" variant="bodySm">
              Письмо отправлено. Если его нет через пару минут, загляни в «Спам».
            </Typography>
          ) : null}
          {error ? (
            <Typography as="p" tone="destructive" variant="bodySm">
              {error}
            </Typography>
          ) : null}
          {state !== 'sent' ? (
            <Button
              data-testid="email-verification-resend"
              disabled={state === 'sending'}
              onClick={() => void send()}
              size="sm"
              variant="outline"
            >
              {state === 'sending' ? 'Отправляем…' : 'Отправить письмо ещё раз'}
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    </div>
  )
}
