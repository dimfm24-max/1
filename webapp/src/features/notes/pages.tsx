import {
  noteResponseSchema,
  notesResponseSchema,
  createNoteRequestSchema,
  updateNoteRequestSchema,
  type CreateNoteRequest,
  type NoteDto,
  type NotesResponse,
  type UpdateNoteRequest,
} from '@dilife/contracts'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { sessionQueryKeys, useAuth } from '@/features/auth'
import { useTrashedNotice } from '@/features/trash'
import { useGoalTreeQuery } from '@/features/goals'
import type { AuthenticatedTransport } from '@/platform/api'

const noteQueryKeys = {
  list: () => [...sessionQueryKeys.all, 'notes'] as const,
}

function fetchNotes(transport: AuthenticatedTransport, options?: { signal?: AbortSignal }) {
  return transport.request('/api/notes', notesResponseSchema, { signal: options?.signal })
}

function notesQueryOptions(transport: AuthenticatedTransport) {
  return queryOptions({
    queryKey: noteQueryKeys.list(),
    queryFn: ({ signal }) => fetchNotes(transport, { signal }),
  })
}

export function NotesPage() {
  const auth = useAuth()
  const notes = useQuery(notesQueryOptions(auth.transport))
  const goals = useGoalTreeQuery()

  if (notes.isPending) {
    return (
      <section className="flex min-h-48 items-center justify-center" data-testid="notes-loading">
        <Spinner />
      </section>
    )
  }

  if (notes.isError) {
    return (
      <Alert data-testid="notes-error" variant="destructive">
        <AlertTitle>Не удалось загрузить заметки</AlertTitle>
        <AlertDescription>Проверь интернет и обнови страницу.</AlertDescription>
      </Alert>
    )
  }

  const goalTitles = new Map(
    (goals.data?.goals ?? []).map((goal) => [goal.id, goal.title] as const),
  )

  return (
    <section className="flex flex-col gap-6 p-4 md:p-6" data-testid="notes-page">
      <NewNoteForm goals={goals.data?.goals ?? []} />

      <div className="flex flex-col gap-3">
        <Typography as="h2" variant="h6">
          Заметки
        </Typography>
        {notes.data.notes.length === 0 ? (
          <Typography data-testid="notes-empty" tone="muted" variant="bodySm">
            Заметок пока нет. Сюда стоит записывать то, что пришло по пути: мысль переживёт
            цель, к которой она относилась.
          </Typography>
        ) : (
          notes.data.notes.map((note) => (
            <NoteCard goalTitle={goalTitles.get(note.goalId ?? '')} key={note.id} note={note} />
          ))
        )}
      </div>
    </section>
  )
}

function NoteCard({ goalTitle, note }: { goalTitle?: string; note: NoteDto }) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [body, setBody] = useState(note.body)

  const update = useMutation({
    mutationFn: (input: UpdateNoteRequest) =>
      auth.transport.request(`/api/notes/${note.id}`, noteResponseSchema, {
        method: 'PATCH',
        body: updateNoteRequestSchema.parse(input),
      }),
    onSuccess: (response) => {
      queryClient.setQueryData<NotesResponse>(noteQueryKeys.list(), (current) =>
        current
          ? {
              notes: current.notes.map((existing) =>
                existing.id === response.note.id ? response.note : existing,
              ),
            }
          : current,
      )
      setIsEditing(false)
    },
  })

  const notifyTrashed = useTrashedNotice()
  const remove = useMutation({
    mutationFn: () =>
      auth.transport.request(`/api/notes/${note.id}`, notesResponseSchema, { method: 'DELETE' }),
    onSuccess: (response) => {
      queryClient.setQueryData<NotesResponse>(noteQueryKeys.list(), response)
      notifyTrashed('note', note.id, 'Заметка')
    },
  })

  return (
    <Card data-testid={`note-${note.id}`}>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Typography as="h3" variant="bodySmMedium">
            {note.title ?? 'Без заголовка'}
          </Typography>
          {goalTitle ? <Badge variant="outline">{goalTitle}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isEditing ? (
          <Textarea
            aria-label="Текст заметки"
            data-testid={`note-body-${note.id}`}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            value={body}
          />
        ) : (
          <Typography className="whitespace-pre-wrap" variant="bodySm">
            {note.body}
          </Typography>
        )}
        <div className="flex flex-wrap gap-2">
          {isEditing ? (
            <Button
              data-testid={`note-save-${note.id}`}
              disabled={body.trim() === '' || update.isPending}
              onClick={() => update.mutate({ body: body.trim() })}
              size="sm"
              type="button"
            >
              Сохранить
            </Button>
          ) : (
            <Button
              data-testid={`note-edit-${note.id}`}
              onClick={() => setIsEditing(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              Изменить
            </Button>
          )}
          <Button
            data-testid={`note-delete-${note.id}`}
            onClick={() => remove.mutate()}
            size="sm"
            type="button"
            variant="ghost"
          >
            Удалить
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function NewNoteForm({ goals }: { goals: ReadonlyArray<{ id: string; title: string }> }) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [goalId, setGoalId] = useState('')

  const create = useMutation({
    mutationFn: (input: CreateNoteRequest) =>
      auth.transport.request('/api/notes', noteResponseSchema, {
        method: 'POST',
        body: createNoteRequestSchema.parse(input),
      }),
    onSuccess: (response) => {
      queryClient.setQueryData<NotesResponse>(noteQueryKeys.list(), (current) =>
        current ? { notes: [response.note, ...current.notes] } : current,
      )
      setTitle('')
      setBody('')
    },
  })

  return (
    <Card data-testid="new-note-form">
      <CardHeader>
        <Typography as="h2" variant="h6">
          Новая заметка
        </Typography>
        <CardDescription>Заголовок необязателен — записывай как пишется.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Input
          aria-label="Заголовок"
          data-testid="note-title"
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Заголовок"
          value={title}
        />
        <Textarea
          aria-label="Текст заметки"
          data-testid="note-body"
          onChange={(event) => setBody(event.target.value)}
          placeholder="Что пришло в голову"
          rows={4}
          value={body}
        />
        {goals.length === 0 ? null : (
          <NativeSelect
            aria-label="Цель"
            data-testid="note-goal"
            onChange={(event) => setGoalId(event.target.value)}
            value={goalId}
          >
            <option value="">Без цели</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </NativeSelect>
        )}
        <Button
          className="self-start"
          data-testid="note-submit"
          disabled={body.trim() === '' || create.isPending}
          onClick={() =>
            create.mutate({
              title: title.trim() === '' ? null : title.trim(),
              body: body.trim(),
              goalId: goalId === '' ? null : goalId,
            })
          }
          type="button"
        >
          Записать
        </Button>
      </CardContent>
    </Card>
  )
}
