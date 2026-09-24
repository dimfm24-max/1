import {
  apiErrorSchema,
  settingsWithClockResponseSchema,
  updateSettingsRequestSchema,
} from '@dilife/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'

import { validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import type { SettingsService } from '../application/settings-service'
import { executeSettings } from './errors'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]

const commonErrors = {
  ...ingressErrorResponses,
  400: { content: errorContent, description: 'Invalid payload or unknown time zone' },
  401: { content: errorContent, description: 'Authentication required' },
}

const settingsOk = {
  200: {
    content: { 'application/json': { schema: settingsWithClockResponseSchema } },
    description: "The settings and the person's own clock worked out from them",
  },
}

const readRoute = createRoute({
  method: 'get',
  path: '/',
  security: bearerSecurity,
  responses: { ...commonErrors, ...settingsOk },
})

const updateRoute = createRoute({
  method: 'patch',
  path: '/',
  security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: updateSettingsRequestSchema } } } },
  responses: { ...commonErrors, ...settingsOk },
})

type CreateSettingsRoutesOptions = {
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  service: SettingsService
}

export function createSettingsRoutes({ requireAuth, service }: CreateSettingsRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })

  routes.use('*', requireAuth)

  routes.openapi(readRoute, async (c) => {
    return c.json(await service.readWithClock(c.var.user), 200)
  })

  routes.openapi(updateRoute, async (c) => {
    const result = await executeSettings(() => service.update(c.var.user, c.req.valid('json')))
    return c.json(result, 200)
  })

  return routes
}
