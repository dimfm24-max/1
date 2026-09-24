import {
  apiErrorSchema,
  createNoteRequestSchema,
  noteIdParamsSchema,
  noteResponseSchema,
  notesResponseSchema,
  updateNoteRequestSchema,
} from '@dilife/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import { validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import type { NotesRepository } from '../application/ports'
import { executeNotes } from './errors'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]

const commonErrors = {
  ...ingressErrorResponses,
  400: { content: errorContent, description: 'Invalid payload' },
  401: { content: errorContent, description: 'Authentication required' },
  404: { content: errorContent, description: 'No such note or goal for this account' },
}

const notesOk = {
  200: {
    content: { 'application/json': { schema: notesResponseSchema } },
    description: 'Notes, most recently touched first',
  },
}

const listRoute = createRoute({
  method: 'get',
  path: '/',
  security: bearerSecurity,
  request: { query: z.object({ goalId: z.uuid().optional() }).strict() },
  responses: { ...commonErrors, ...notesOk },
})

const createNoteRoute = createRoute({
  method: 'post',
  path: '/',
  security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: createNoteRequestSchema } } } },
  responses: {
    ...commonErrors,
    201: {
      content: { 'application/json': { schema: noteResponseSchema } },
      description: 'The created note',
    },
  },
})

const updateNoteRoute = createRoute({
  method: 'patch',
  path: '/{noteId}',
  security: bearerSecurity,
  request: {
    params: noteIdParamsSchema,
    body: { content: { 'application/json': { schema: updateNoteRequestSchema } } },
  },
  responses: {
    ...commonErrors,
    200: {
      content: { 'application/json': { schema: noteResponseSchema } },
      description: 'The note as it now stands',
    },
  },
})

const deleteNoteRoute = createRoute({
  method: 'delete',
  path: '/{noteId}',
  security: bearerSecurity,
  request: { params: noteIdParamsSchema },
  responses: { ...commonErrors, ...notesOk },
})

type CreateNotesRoutesOptions = {
  repository: NotesRepository
  requireAuth: MiddlewareHandler<AuthHttpEnv>
}

export function createNotesRoutes({ repository, requireAuth }: CreateNotesRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })

  routes.use('*', requireAuth)

  routes.openapi(listRoute, async (c) => {
    const notes = await executeNotes(() =>
      repository.list(c.var.user.id, c.req.valid('query').goalId),
    )
    return c.json({ notes }, 200)
  })

  routes.openapi(createNoteRoute, async (c) => {
    const note = await executeNotes(() => repository.create(c.var.user.id, c.req.valid('json')))
    return c.json({ note }, 201)
  })

  routes.openapi(updateNoteRoute, async (c) => {
    const note = await executeNotes(() =>
      repository.update(c.var.user.id, c.req.valid('param').noteId, c.req.valid('json')),
    )
    return c.json({ note }, 200)
  })

  routes.openapi(deleteNoteRoute, async (c) => {
    const notes = await executeNotes(() =>
      repository.remove(c.var.user.id, c.req.valid('param').noteId, new Date()),
    )
    return c.json({ notes }, 200)
  })

  return routes
}
