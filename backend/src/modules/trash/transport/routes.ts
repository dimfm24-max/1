import {
  apiErrorSchema,
  trashItemParamsSchema,
  trashListResponseSchema,
  trashPurgeResponseSchema,
  trashRestoreResponseSchema,
} from '@dilife/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'

import { AppError, validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import { TrashNotFound, type TrashService } from '../application/trash-service'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]

const commonErrors = {
  ...ingressErrorResponses,
  400: { content: errorContent, description: 'Invalid kind or id' },
  401: { content: errorContent, description: 'Authentication required' },
  404: { content: errorContent, description: 'Nothing like that is in this person’s trash' },
}

const listRoute = createRoute({
  method: 'get',
  path: '/',
  security: bearerSecurity,
  responses: {
    ...commonErrors,
    200: {
      content: { 'application/json': { schema: trashListResponseSchema } },
      description: 'Everything in the trash, most recently deleted first',
    },
  },
})

const restoreRoute = createRoute({
  method: 'post',
  path: '/{kind}/{id}/restore',
  security: bearerSecurity,
  request: { params: trashItemParamsSchema },
  responses: {
    ...commonErrors,
    200: {
      content: { 'application/json': { schema: trashRestoreResponseSchema } },
      description: 'What came back, with any parent that had to come back with it',
    },
  },
})

const purgeRoute = createRoute({
  method: 'delete',
  path: '/{kind}/{id}',
  security: bearerSecurity,
  request: { params: trashItemParamsSchema },
  responses: {
    ...commonErrors,
    200: {
      content: { 'application/json': { schema: trashPurgeResponseSchema } },
      description: 'Removed for good',
    },
  },
})

async function executeTrash<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof TrashNotFound) throw new AppError(404, 'NOT_FOUND', error.message)
    throw error
  }
}

export function createTrashRoutes({
  requireAuth,
  service,
}: {
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  service: TrashService
}) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })

  routes.use('*', requireAuth)

  routes.openapi(listRoute, async (c) => {
    return c.json(await service.list(c.var.user), 200)
  })

  routes.openapi(restoreRoute, async (c) => {
    const { kind, id } = c.req.valid('param')
    return c.json(await executeTrash(() => service.restore(c.var.user, kind, id)), 200)
  })

  routes.openapi(purgeRoute, async (c) => {
    const { kind, id } = c.req.valid('param')
    await executeTrash(() => service.purge(c.var.user, kind, id))
    return c.json({ purged: true as const }, 200)
  })

  return routes
}
