import {
  apiErrorSchema,
  commentIdParamsSchema,
  createCommentRequestSchema,
  dayDateSchema,
  publicProfileResponseSchema,
  shareCommentSchema,
  shareSettingsResponseSchema,
  shareTokenParamsSchema,
  updateShareRequestSchema,
} from '@dilife/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import { validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import type { SharingRepository } from '../application/ports'
import { executeSharing } from './errors'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]

const ownerErrors = {
  ...ingressErrorResponses,
  400: { content: errorContent, description: 'Invalid payload' },
  401: { content: errorContent, description: 'Authentication required' },
  404: { content: errorContent, description: 'Sharing is not enabled' },
}

const settingsOk = {
  200: {
    content: { 'application/json': { schema: shareSettingsResponseSchema } },
    description: 'The sharing settings as they now stand',
  },
}

const commentsOk = {
  200: {
    content: {
      'application/json': { schema: z.object({ comments: z.array(shareCommentSchema) }) },
    },
    description: 'Every comment on the page, oldest first',
  },
}

const readSettingsRoute = createRoute({
  method: 'get',
  path: '/settings',
  security: bearerSecurity,
  responses: { ...ownerErrors, ...settingsOk },
})

const enableRoute = createRoute({
  method: 'post',
  path: '/enable',
  security: bearerSecurity,
  responses: { ...ownerErrors, ...settingsOk },
})

const rotateRoute = createRoute({
  method: 'post',
  path: '/rotate',
  security: bearerSecurity,
  responses: { ...ownerErrors, ...settingsOk },
})

const disableRoute = createRoute({
  method: 'post',
  path: '/disable',
  security: bearerSecurity,
  responses: { ...ownerErrors, ...settingsOk },
})

const updateSettingsRoute = createRoute({
  method: 'patch',
  path: '/settings',
  security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: updateShareRequestSchema } } } },
  responses: { ...ownerErrors, ...settingsOk },
})

const deleteCommentRoute = createRoute({
  method: 'delete',
  path: '/comments/{commentId}',
  security: bearerSecurity,
  request: { params: commentIdParamsSchema },
  responses: { ...ownerErrors, ...commentsOk },
})

/**
 * The public half. No session, because the token is the permission - requiring an account would
 * defeat the point of handing someone a link.
 */
const publicErrors = {
  ...ingressErrorResponses,
  400: { content: errorContent, description: 'Invalid payload' },
  404: { content: errorContent, description: 'No such page' },
}

const readPublicRoute = createRoute({
  method: 'get',
  path: '/public/{token}',
  request: {
    params: shareTokenParamsSchema,
    query: z.object({ today: dayDateSchema }).strict(),
  },
  responses: {
    ...publicErrors,
    200: {
      content: { 'application/json': { schema: publicProfileResponseSchema } },
      description: 'What the owner chose to show',
    },
  },
})

const createCommentRoute = createRoute({
  method: 'post',
  path: '/public/{token}/comments',
  request: {
    params: shareTokenParamsSchema,
    body: { content: { 'application/json': { schema: createCommentRequestSchema } } },
  },
  responses: { ...publicErrors, ...commentsOk },
})

type CreateSharingRoutesOptions = {
  repository: SharingRepository
  requireAuth: MiddlewareHandler<AuthHttpEnv>
}

export function createSharingRoutes({ repository, requireAuth }: CreateSharingRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })

  // The public routes are registered first and are not behind the guard; everything else is.
  routes.openapi(readPublicRoute, async (c) => {
    const profile = await executeSharing(() =>
      repository.readPublicProfile(c.req.valid('param').token, c.req.valid('query').today),
    )
    return c.json(profile, 200)
  })

  routes.openapi(createCommentRoute, async (c) => {
    const comments = await executeSharing(() =>
      repository.addComment(c.req.valid('param').token, c.req.valid('json')),
    )
    return c.json({ comments }, 200)
  })

  routes.use('/settings', requireAuth)
  routes.use('/enable', requireAuth)
  routes.use('/rotate', requireAuth)
  routes.use('/disable', requireAuth)
  routes.use('/comments/*', requireAuth)

  routes.openapi(readSettingsRoute, async (c) => {
    const share = await executeSharing(() => repository.settingsFor(c.var.user.id))
    return c.json({ share }, 200)
  })

  routes.openapi(enableRoute, async (c) => {
    const share = await executeSharing(() => repository.enable(c.var.user.id))
    return c.json({ share }, 200)
  })

  routes.openapi(rotateRoute, async (c) => {
    const share = await executeSharing(() => repository.rotate(c.var.user.id))
    return c.json({ share }, 200)
  })

  routes.openapi(disableRoute, async (c) => {
    const share = await executeSharing(() => repository.disable(c.var.user.id))
    return c.json({ share }, 200)
  })

  routes.openapi(updateSettingsRoute, async (c) => {
    const share = await executeSharing(() =>
      repository.updateSettings(c.var.user.id, c.req.valid('json')),
    )
    return c.json({ share }, 200)
  })

  routes.openapi(deleteCommentRoute, async (c) => {
    const comments = await executeSharing(() =>
      repository.deleteComment(c.var.user.id, c.req.valid('param').commentId),
    )
    return c.json({ comments }, 200)
  })

  return routes
}
