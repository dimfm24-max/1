import {
  createCommentRequestSchema,
  publicProfileResponseSchema,
  shareCommentSchema,
  shareSettingsResponseSchema,
  updateShareRequestSchema,
  type PublicProfileResponse,
  type ShareSettingsDto,
  type UpdateShareRequest,
} from '@dilife/contracts'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { z } from 'zod'

import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { sessionQueryKeys, useAuth } from '@/features/auth'
import { toDayDate } from '@/features/day'
import { HttpClient } from '@/platform/api'

const commentsSchema = z.object({ comments: z.array(shareCommentSchema) })

const shareQueryKeys = {
  settings: () => [...sessionQueryKeys.all, 'share', 'settings'] as const,
  publicProfile: (token: string) => ['share', 'public', token] as const,
}

export function SharingSettingsPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const settings = useQuery(
    queryOptions({
      queryKey: shareQueryKeys.settings(),
      queryFn: ({ signal }) =>
        auth.transport.request('/api/share/settings', shareSettingsResponseSchema, { signal }),
    }),
  )

  const write = useMutation({
    mutationFn: (action: { path: string; method: 'POST' | 'PATCH'; body?: UpdateShareRequest }) =>
      auth.transport.request(action.path, shareSettingsResponseSchema, {
        method: action.method,
        ...(action.body === undefined
          ? {}
          : { body: updateShareRequestSchema.parse(action.body) }),
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(shareQueryKeys.settings(), response)
    },
  })

  if (settings.isPending) {
    return (
      <section className="flex min-h-48 items-center justify-center" data-testid="share-loading">
        <Spinner />
      </section>
    )
  }

  if (settings.isError) {
    return (
      <Alert data-testid="share-error" variant="destructive">
        <AlertTitle>Не удалось загрузить настройки доступа</AlertTitle>
        <AlertDescription>Проверьте соединение и обновите страницу.</AlertDescription>
      </Alert>
    )
  }

  const share = settings.data.share
  const link = share.token === null ? null : `${window.location.origin}/p/${share.token}`

  return (
    <section className="flex flex-col gap-6 p-4 md:p-6" data-testid="share-page">
      <Card>
        <CardHeader>
          <Typography as="h1" variant="h5">
            Доступ по ссылке
          </Typography>
          <CardDescription>
            Страница открывается без входа: кто знает адрес, тот и видит. Почта и данные входа
            на ней не показываются.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {link === null ? (
            <Button
              data-testid="share-enable"
              disabled={write.isPending}
              onClick={() => write.mutate({ path: '/api/share/enable', method: 'POST' })}
              type="button"
            >
              Создать ссылку
            </Button>
          ) : (
            <>
              <Input aria-label="Ссылка" data-testid="share-link" readOnly value={link} />
              <SectionSwitches
                onChange={(body) =>
                  write.mutate({ path: '/api/share/settings', method: 'PATCH', body })
                }
                share={share}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  data-testid="share-rotate"
                  onClick={() => write.mutate({ path: '/api/share/rotate', method: 'POST' })}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Сменить адрес
                </Button>
                <Button
                  data-testid="share-disable"
                  onClick={() => write.mutate({ path: '/api/share/disable', method: 'POST' })}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Закрыть доступ
                </Button>
              </div>
              <Typography tone="muted" variant="caption">
                Смена адреса сразу ломает прежнюю ссылку. Закрытие доступа удаляет страницу
                вместе с комментариями.
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function SectionSwitches({
  onChange,
  share,
}: {
  onChange: (body: UpdateShareRequest) => void
  share: ShareSettingsDto
}) {
  const sections = [
    { key: 'showsGoals' as const, label: 'Цели' },
    { key: 'showsHabits' as const, label: 'Привычки' },
    { key: 'showsStatistics' as const, label: 'Статистика' },
  ]

  return (
    <ul className="flex flex-col gap-2">
      {sections.map((section) => (
        <li className="flex items-center justify-between gap-4" key={section.key}>
          <Typography variant="bodySm">{section.label}</Typography>
          <Switch
            aria-label={section.label}
            checked={share[section.key]}
            data-testid={`share-${section.key}`}
            onCheckedChange={(checked) => onChange({ [section.key]: checked })}
          />
        </li>
      ))}
    </ul>
  )
}

/**
 * The page a link opens. It runs with no session at all, so it talks to the API directly rather
 * than through the authenticated transport - there is nothing to authenticate with.
 */
export function PublicProfilePage({ token }: { token: string }) {
  const [today] = useState(() => toDayDate(new Date()))
  const client = new HttpClient()
  const queryClient = useQueryClient()

  const profile = useQuery(
    queryOptions({
      queryKey: shareQueryKeys.publicProfile(token),
      queryFn: ({ signal }) =>
        client.request(
          `/api/share/public/${token}?today=${today}`,
          publicProfileResponseSchema,
          { signal },
        ),
    }),
  )

  const comment = useMutation({
    mutationFn: (input: { authorName: string; body: string }) =>
      client.request(`/api/share/public/${token}/comments`, commentsSchema, {
        method: 'POST',
        body: createCommentRequestSchema.parse(input),
      }),
    onSuccess: (response) => {
      queryClient.setQueryData<PublicProfileResponse>(
        shareQueryKeys.publicProfile(token),
        (current) => (current ? { ...current, comments: response.comments } : current),
      )
    },
  })

  if (profile.isPending) {
    return (
      <main className="flex min-h-svh items-center justify-center" data-testid="public-loading">
        <Spinner />
      </main>
    )
  }

  if (profile.isError) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6" data-testid="public-missing">
        <Typography as="h1" variant="h5">
          Страница не найдена
        </Typography>
        <Typography tone="muted" variant="bodySm">
          Ссылка могла быть закрыта или заменена.
        </Typography>
      </main>
    )
  }

  const page = profile.data

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4 md:p-6" data-testid="public-page">
      <div className="flex flex-col gap-1">
        <Typography as="h1" variant="h5">
          {page.displayName ?? 'Путь к цели'}
        </Typography>
        {page.lifeGoalTitle ? (
          <Typography tone="muted" variant="bodySm">
            {page.lifeGoalTitle}
          </Typography>
        ) : null}
      </div>

      {page.goals === null ? null : (
        <Card data-testid="public-goals">
          <CardHeader>
            <Typography as="h2" variant="h6">
              Цели
            </Typography>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {page.goals.length === 0 ? (
              <Typography tone="muted" variant="bodySm">
                Пока ни одной цели.
              </Typography>
            ) : (
              page.goals.map((goal) => (
                <div className="flex flex-col gap-1" key={goal.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Typography variant="bodySmMedium">{goal.title}</Typography>
                    {goal.status === 'active' ? null : (
                      <Badge variant="outline">
                        {goal.status === 'completed' ? 'Завершена' : 'Брошена'}
                      </Badge>
                    )}
                  </div>
                  <Typography tone="muted" variant="caption">
                    {goal.currentValue} из {goal.targetValue} {goal.measureUnit} ·{' '}
                    {goal.completedSteps} из {goal.totalSteps} шагов
                  </Typography>
                  <Progress
                    aria-label={`Продвижение цели «${goal.title}»`}
                    value={
                      goal.targetValue > 0
                        ? Math.min(Math.round((goal.currentValue / goal.targetValue) * 100), 100)
                        : 0
                    }
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {page.habits === null ? null : (
        <Card data-testid="public-habits">
          <CardHeader>
            <Typography as="h2" variant="h6">
              Привычки
            </Typography>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {page.habits.map((habit) => (
              <div className="flex items-center justify-between gap-4" key={habit.id}>
                <Typography variant="bodySm">{habit.title}</Typography>
                <Typography tone="muted" variant="caption">
                  серия {habit.currentStreak}
                </Typography>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {page.statistics === null ? null : (
        <Card data-testid="public-statistics">
          <CardHeader>
            <Typography as="h2" variant="h6">
              Всего
            </Typography>
            <CardDescription>
              Сделано задач: {page.statistics.done} · дней с делами: {page.statistics.activeDays}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <CommentsPanel
        comments={page.comments}
        isPending={comment.isPending}
        onSubmit={(input) => comment.mutate(input)}
      />
    </main>
  )
}

function CommentsPanel({
  comments,
  isPending,
  onSubmit,
}: {
  comments: PublicProfileResponse['comments']
  isPending: boolean
  onSubmit: (input: { authorName: string; body: string }) => void
}) {
  const [authorName, setAuthorName] = useState('')
  const [body, setBody] = useState('')

  return (
    <Card data-testid="public-comments">
      <CardHeader>
        <Typography as="h2" variant="h6">
          Комментарии
        </Typography>
        <CardDescription>
          Имя вы указываете сами — оно ничем не подтверждается.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {comments.length === 0 ? (
          <Typography tone="muted" variant="bodySm">
            Комментариев пока нет.
          </Typography>
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((entry) => (
              <li className="flex flex-col gap-1" key={entry.id}>
                <Typography variant="bodySmMedium">{entry.authorName}</Typography>
                <Typography className="whitespace-pre-wrap" variant="bodySm">
                  {entry.body}
                </Typography>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          <Input
            aria-label="Ваше имя"
            data-testid="comment-name"
            maxLength={80}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder="Как вас зовут"
            value={authorName}
          />
          <Textarea
            aria-label="Комментарий"
            data-testid="comment-body"
            maxLength={2000}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Что хотите сказать"
            rows={3}
            value={body}
          />
          <Button
            className="self-start"
            data-testid="comment-submit"
            disabled={authorName.trim() === '' || body.trim() === '' || isPending}
            onClick={() => {
              onSubmit({ authorName: authorName.trim(), body: body.trim() })
              setBody('')
            }}
            type="button"
          >
            Отправить
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
