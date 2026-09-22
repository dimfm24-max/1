import {
  apiErrorSchema,
  statisticsQuerySchema,
  statisticsResponseSchema,
} from '@dilife/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'

import { validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import type { StatisticsReader } from '../application/ports'

const errorContent = { 'application/json': { schema: apiErrorSchema } }

const readRoute = createRoute({
  method: 'get',
  path: '/',
  security: [{ BearerAuth: [] }],
  request: { query: statisticsQuerySchema },
  responses: {
    ...ingressErrorResponses,
    200: {
      content: { 'application/json': { schema: statisticsResponseSchema } },
      description: 'Counts over the requested window',
    },
    400: { content: errorContent, description: 'Invalid query' },
    401: { content: errorContent, description: 'Authentication required' },
  },
})

type CreateStatisticsRoutesOptions = {
  reader: StatisticsReader
  requireAuth: MiddlewareHandler<AuthHttpEnv>
}

export function createStatisticsRoutes({ reader, requireAuth }: CreateStatisticsRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })

  routes.use('*', requireAuth)

  routes.openapi(readRoute, async (c) => {
    const query = c.req.valid('query')
    return c.json(await reader.read(c.var.user.id, query.period, query.today), 200)
  })

  return routes
}
