import {
  apiErrorSchema,
  updateProfileRequestSchema,
  updateProfileResponseSchema,
} from '@dilife/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'

import { validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import type { UsersService } from '../application/users-service'
import { executeUsers } from './errors'

const errorContent = {
  'application/json': {
    schema: apiErrorSchema,
  },
}

const bearerSecurity = [{ BearerAuth: [] }]

const updateProfileRoute = createRoute({
  method: 'patch',
  path: '/me',
  security: bearerSecurity,
  request: {
    body: {
      content: {
        'application/json': {
          schema: updateProfileRequestSchema,
        },
      },
    },
  },
  responses: {
    ...ingressErrorResponses,
    200: {
      content: { 'application/json': { schema: updateProfileResponseSchema } },
      description: 'Updated current user profile',
    },
    400: { content: errorContent, description: 'Invalid payload' },
    401: { content: errorContent, description: 'Authentication required' },
  },
})

const completeOnboardingRoute = createRoute({
  method: 'post',
  path: '/me/onboarding',
  security: bearerSecurity,
  responses: {
    ...ingressErrorResponses,
    200: {
      content: { 'application/json': { schema: updateProfileResponseSchema } },
      description: 'The user with the first-run wizard marked done',
    },
    401: { content: errorContent, description: 'Authentication required' },
  },
})

type CreateUsersRoutesOptions = {
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  service: UsersService
}

export function createUsersRoutes({ requireAuth, service }: CreateUsersRoutesOptions) {
  const userRoutes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })

  userRoutes.use('*', requireAuth)
  userRoutes.openapi(updateProfileRoute, async (c) => {
    const result = await executeUsers(() =>
      service.updateProfile(c.var.user, c.req.valid('json')),
    )
    return c.json(result, 200)
  })

  userRoutes.openapi(completeOnboardingRoute, async (c) => {
    const result = await executeUsers(() => service.completeOnboarding(c.var.user))
    return c.json(result, 200)
  })

  return { userRoutes }
}
