import {
  Alert02Icon,
  FileNotFoundIcon,
  ShieldUserIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
} from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { Typography } from '@/components/typography'

type HomeDestination = '/login' | '/app'

export function SessionLoadingSection() {
  return (
    <RouteStateCard
      description="Проверяем вход…"
      icon={ShieldUserIcon}
      title="Открываем DiLife"
    >
      <Spinner />
    </RouteStateCard>
  )
}

export function SessionErrorSection({ retry }: { retry: () => Promise<void> }) {
  const [retryPending, setRetryPending] = useState(false)

  async function retrySession() {
    setRetryPending(true)
    try {
      await retry()
    } catch {
      // The existing session error remains visible and retryable.
    } finally {
      setRetryPending(false)
    }
  }

  return (
    <RouteStateCard
      alert
      testId="session-error"
      description="Ты по-прежнему в аккаунте. Проверь интернет и попробуй ещё раз."
      icon={Alert02Icon}
      title="Не удалось проверить вход"
    >
      <Button
        data-testid="session-retry"
        disabled={retryPending}
        onClick={() => void retrySession()}
        type="button"
      >
        {retryPending ? 'Пробуем снова…' : 'Попробовать снова'}
      </Button>
    </RouteStateCard>
  )
}

export function NotFoundSection({ destination }: { destination: HomeDestination }) {
  const authenticated = destination !== '/login'

  return (
    <RouteStateCard
      description="Такой страницы нет, или она переехала."
      icon={FileNotFoundIcon}
      testId="not-found"
      title="Страница не найдена"
    >
      <Button asChild>
        {authenticated ? (
          <Link data-testid="not-found-home" to={destination}>
            На главную
          </Link>
        ) : (
          <Link search={{ returnTo: undefined }} to="/login">Ко входу</Link>
        )}
      </Button>
    </RouteStateCard>
  )
}

function RouteStateCard({
  alert = false,
  children,
  description,
  icon,
  testId,
  title,
}: {
  alert?: boolean
  children: ReactNode
  description: string
  icon: IconSvgElement
  testId?: string
  title: string
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-5">
      <Card className="w-full max-w-lg shadow-sm" data-testid={testId}>
        <CardContent>
          <Empty
            aria-live={alert ? 'assertive' : undefined}
            role={alert ? 'alert' : undefined}
            size="sm"
          >
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon aria-hidden icon={icon} strokeWidth={2} />
              </EmptyMedia>
              <Typography as="h1" variant="h4" balance>
                {title}
              </Typography>
              <Typography variant="bodySm" tone="muted" align="center" pretty>
                {description}
              </Typography>
            </EmptyHeader>
            <EmptyContent>{children}</EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    </main>
  )
}
