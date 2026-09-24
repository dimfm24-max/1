import {
  apiErrorSchema,
  createHabitRequestSchema,
  dayDateSchema,
  habitIdParamsSchema,
  habitResponseSchema,
  habitsResponseSchema,
  markHabitRequestSchema,
  updateHabitRequestSchema,
} from '@dilife/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import { validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import type { HabitsService } from '../application/habits-service'
import { executeHabits } from './errors'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]

const commonErrors = {
  ...ingressErrorResponses,
  400: { content: errorContent, description: 'Invalid payload' },
  401: { content: errorContent, description: 'Authentication required' },
}

const withNotFound = {
  ...commonErrors,
  404: { content: errorContent, description: 'No such habit for this account' },
}

const habitOk = {
  200: {
    content: { 'application/json': { schema: habitResponseSchema } },
    description: 'The habit with its streaks recomputed',
  },
}

const habitsOk = {
  200: {
    content: { 'application/json': { schema: habitsResponseSchema } },
    description: 'Every habit, in order',
  },
}

/**
 * Older clients still send `today`; it is accepted and ignored for one release, because the
 * server now works the day out from the person's own settings. Remove the field afterwards.
 */
const todayQuerySchema = z.object({ today: dayDateSchema.optional() }).strict()

const listRoute = createRoute({
  method: 'get',
  path: '/',
  security: bearerSecurity,
  request: { query: todayQuerySchema },
  responses: { ...commonErrors, ...habitsOk },
})

const createHabitRoute = createRoute({
  method: 'post',
  path: '/',
  security: bearerSecurity,
  request: {
    query: todayQuerySchema,
    body: { content: { 'application/json': { schema: createHabitRequestSchema } } },
  },
  responses: {
    ...commonErrors,
    201: {
      content: { 'application/json': { schema: habitResponseSchema } },
      description: 'The created habit',
    },
  },
})

const updateHabitRoute = createRoute({
  method: 'patch',
  path: '/{habitId}',
  security: bearerSecurity,
  request: {
    params: habitIdParamsSchema,
    query: todayQuerySchema,
    body: { content: { 'application/json': { schema: updateHabitRequestSchema } } },
  },
  responses: { ...withNotFound, ...habitOk },
})

const markHabitRoute = createRoute({
  method: 'post',
  path: '/{habitId}/marks',
  security: bearerSecurity,
  request: {
    params: habitIdParamsSchema,
    query: todayQuerySchema,
    body: { content: { 'application/json': { schema: markHabitRequestSchema } } },
  },
  responses: { ...withNotFound, ...habitOk },
})

const deleteHabitRoute = createRoute({
  method: 'delete',
  path: '/{habitId}',
  security: bearerSecurity,
  request: { params: habitIdParamsSchema, query: todayQuerySchema },
  responses: { ...withNotFound, ...habitsOk },
})

type CreateHabitsRoutesOptions = {
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  service: HabitsService
}

export function createHabitsRoutes({ requireAuth, service }: CreateHabitsRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })

  routes.use('*', requireAuth)

  routes.openapi(listRoute, async (c) => {
    const result = await executeHabits(() =>
      service.list(c.var.user),
    )
    return c.json(result, 200)
  })

  routes.openapi(createHabitRoute, async (c) => {
    const result = await executeHabits(() =>
      service.create(c.var.user, c.req.valid('json')),
    )
    return c.json(result, 201)
  })

  routes.openapi(updateHabitRoute, async (c) => {
    const result = await executeHabits(() =>
      service.update(
        c.var.user,
        c.req.valid('param').habitId,
        c.req.valid('json'),
      ),
    )
    return c.json(result, 200)
  })

  routes.openapi(markHabitRoute, async (c) => {
    const result = await executeHabits(() =>
      service.mark(
        c.var.user,
        c.req.valid('param').habitId,
        c.req.valid('json'),
      ),
    )
    return c.json(result, 200)
  })

  routes.openapi(deleteHabitRoute, async (c) => {
    const result = await executeHabits(() =>
      service.remove(c.var.user, c.req.valid('param').habitId),
    )
    return c.json(result, 200)
  })

  return routes
}
