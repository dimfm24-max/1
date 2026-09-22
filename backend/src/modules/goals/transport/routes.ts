import {
  apiErrorSchema,
  closeGoalRequestSchema,
  createGoalRequestSchema,
  createStageRequestSchema,
  createStepRequestSchema,
  goalIdParamsSchema,
  goalResponseSchema,
  goalTreeResponseSchema,
  lifeGoalResponseSchema,
  recordGoalProgressRequestSchema,
  stageIdParamsSchema,
  stepIdParamsSchema,
  updateGoalRequestSchema,
  updateStageRequestSchema,
  updateStepRequestSchema,
  upsertLifeGoalRequestSchema,
} from '@dilife/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'

import { validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import type { GoalsService } from '../application/goals-service'
import { executeGoals } from './errors'

const errorContent = {
  'application/json': {
    schema: apiErrorSchema,
  },
}

const bearerSecurity = [{ BearerAuth: [] }]

const commonErrors = {
  ...ingressErrorResponses,
  400: { content: errorContent, description: 'Invalid payload' },
  401: { content: errorContent, description: 'Authentication required' },
}

const goalErrors = {
  ...commonErrors,
  404: { content: errorContent, description: 'No such goal for this account' },
  409: { content: errorContent, description: 'The goal is closed or counts its steps' },
}

const goalOk = {
  200: {
    content: { 'application/json': { schema: goalResponseSchema } },
    description: 'The goal as it now stands, with its stages and steps',
  },
}

const readTreeRoute = createRoute({
  method: 'get',
  path: '/',
  security: bearerSecurity,
  responses: {
    ...commonErrors,
    200: {
      content: { 'application/json': { schema: goalTreeResponseSchema } },
      description: 'The life goal and every goal below it',
    },
  },
})

const upsertLifeGoalRoute = createRoute({
  method: 'put',
  path: '/life-goal',
  security: bearerSecurity,
  request: {
    body: { content: { 'application/json': { schema: upsertLifeGoalRequestSchema } } },
  },
  responses: {
    ...commonErrors,
    200: {
      content: { 'application/json': { schema: lifeGoalResponseSchema } },
      description: 'The life goal, created or renamed',
    },
  },
})

const createGoalRoute = createRoute({
  method: 'post',
  path: '/goals',
  security: bearerSecurity,
  request: {
    body: { content: { 'application/json': { schema: createGoalRequestSchema } } },
  },
  responses: {
    ...commonErrors,
    201: {
      content: { 'application/json': { schema: goalResponseSchema } },
      description: 'The created goal',
    },
    409: { content: errorContent, description: 'The life goal does not exist yet' },
  },
})

const updateGoalRoute = createRoute({
  method: 'patch',
  path: '/goals/{goalId}',
  security: bearerSecurity,
  request: {
    params: goalIdParamsSchema,
    body: { content: { 'application/json': { schema: updateGoalRequestSchema } } },
  },
  responses: { ...goalErrors, ...goalOk },
})

const recordProgressRoute = createRoute({
  method: 'post',
  path: '/goals/{goalId}/progress',
  security: bearerSecurity,
  request: {
    params: goalIdParamsSchema,
    body: { content: { 'application/json': { schema: recordGoalProgressRequestSchema } } },
  },
  responses: { ...goalErrors, ...goalOk },
})

const closeGoalRoute = createRoute({
  method: 'post',
  path: '/goals/{goalId}/close',
  security: bearerSecurity,
  request: {
    params: goalIdParamsSchema,
    body: { content: { 'application/json': { schema: closeGoalRequestSchema } } },
  },
  responses: { ...goalErrors, ...goalOk },
})

const reopenGoalRoute = createRoute({
  method: 'post',
  path: '/goals/{goalId}/reopen',
  security: bearerSecurity,
  request: {
    params: goalIdParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: z.object({ deadline: z.string().datetime() }).strict(),
        },
      },
    },
  },
  responses: { ...goalErrors, ...goalOk },
})

const setPrimaryGoalRoute = createRoute({
  method: 'post',
  path: '/goals/{goalId}/primary',
  security: bearerSecurity,
  request: { params: goalIdParamsSchema },
  responses: { ...goalErrors, ...goalOk },
})

const deleteGoalRoute = createRoute({
  method: 'delete',
  path: '/goals/{goalId}',
  security: bearerSecurity,
  request: { params: goalIdParamsSchema },
  responses: {
    ...goalErrors,
    200: {
      content: { 'application/json': { schema: goalTreeResponseSchema } },
      description: 'The tree without that goal, and without it as the primary one',
    },
  },
})

const createStageRoute = createRoute({
  method: 'post',
  path: '/goals/{goalId}/stages',
  security: bearerSecurity,
  request: {
    params: goalIdParamsSchema,
    body: { content: { 'application/json': { schema: createStageRequestSchema } } },
  },
  responses: { ...goalErrors, ...goalOk },
})

const updateStageRoute = createRoute({
  method: 'patch',
  path: '/stages/{stageId}',
  security: bearerSecurity,
  request: {
    params: stageIdParamsSchema,
    body: { content: { 'application/json': { schema: updateStageRequestSchema } } },
  },
  responses: { ...goalErrors, ...goalOk },
})

const deleteStageRoute = createRoute({
  method: 'delete',
  path: '/stages/{stageId}',
  security: bearerSecurity,
  request: { params: stageIdParamsSchema },
  responses: { ...goalErrors, ...goalOk },
})

const createStepRoute = createRoute({
  method: 'post',
  path: '/stages/{stageId}/steps',
  security: bearerSecurity,
  request: {
    params: stageIdParamsSchema,
    body: { content: { 'application/json': { schema: createStepRequestSchema } } },
  },
  responses: { ...goalErrors, ...goalOk },
})

const updateStepRoute = createRoute({
  method: 'patch',
  path: '/steps/{stepId}',
  security: bearerSecurity,
  request: {
    params: stepIdParamsSchema,
    body: { content: { 'application/json': { schema: updateStepRequestSchema } } },
  },
  responses: { ...goalErrors, ...goalOk },
})

const deleteStepRoute = createRoute({
  method: 'delete',
  path: '/steps/{stepId}',
  security: bearerSecurity,
  request: { params: stepIdParamsSchema },
  responses: { ...goalErrors, ...goalOk },
})

type CreateGoalsRoutesOptions = {
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  service: GoalsService
}

export function createGoalsRoutes({ requireAuth, service }: CreateGoalsRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })

  routes.use('*', requireAuth)

  routes.openapi(readTreeRoute, async (c) => {
    return c.json(await executeGoals(() => service.readTree(c.var.user)), 200)
  })

  routes.openapi(upsertLifeGoalRoute, async (c) => {
    const result = await executeGoals(() =>
      service.upsertLifeGoal(c.var.user, c.req.valid('json')),
    )
    return c.json(result, 200)
  })

  routes.openapi(createGoalRoute, async (c) => {
    const result = await executeGoals(() => service.createGoal(c.var.user, c.req.valid('json')))
    return c.json(result, 201)
  })

  routes.openapi(updateGoalRoute, async (c) => {
    const result = await executeGoals(() =>
      service.updateGoal(c.var.user, c.req.valid('param').goalId, c.req.valid('json')),
    )
    return c.json(result, 200)
  })

  routes.openapi(recordProgressRoute, async (c) => {
    const result = await executeGoals(() =>
      service.recordProgress(c.var.user, c.req.valid('param').goalId, c.req.valid('json')),
    )
    return c.json(result, 200)
  })

  routes.openapi(closeGoalRoute, async (c) => {
    const result = await executeGoals(() =>
      service.closeGoal(c.var.user, c.req.valid('param').goalId, c.req.valid('json')),
    )
    return c.json(result, 200)
  })

  routes.openapi(reopenGoalRoute, async (c) => {
    const result = await executeGoals(() =>
      service.reopenGoal(c.var.user, c.req.valid('param').goalId, c.req.valid('json')),
    )
    return c.json(result, 200)
  })

  routes.openapi(setPrimaryGoalRoute, async (c) => {
    const result = await executeGoals(() =>
      service.setPrimaryGoal(c.var.user, c.req.valid('param').goalId),
    )
    return c.json(result, 200)
  })

  routes.openapi(deleteGoalRoute, async (c) => {
    const tree = await executeGoals(() =>
      service.deleteGoal(c.var.user, c.req.valid('param').goalId),
    )
    return c.json(tree, 200)
  })

  routes.openapi(createStageRoute, async (c) => {
    const result = await executeGoals(() =>
      service.createStage(c.var.user, c.req.valid('param').goalId, c.req.valid('json')),
    )
    return c.json(result, 200)
  })

  routes.openapi(updateStageRoute, async (c) => {
    const result = await executeGoals(() =>
      service.updateStage(c.var.user, c.req.valid('param').stageId, c.req.valid('json')),
    )
    return c.json(result, 200)
  })

  routes.openapi(deleteStageRoute, async (c) => {
    const result = await executeGoals(() =>
      service.deleteStage(c.var.user, c.req.valid('param').stageId),
    )
    return c.json(result, 200)
  })

  routes.openapi(createStepRoute, async (c) => {
    const result = await executeGoals(() =>
      service.createStep(c.var.user, c.req.valid('param').stageId, c.req.valid('json')),
    )
    return c.json(result, 200)
  })

  routes.openapi(updateStepRoute, async (c) => {
    const result = await executeGoals(() =>
      service.updateStep(c.var.user, c.req.valid('param').stepId, c.req.valid('json')),
    )
    return c.json(result, 200)
  })

  routes.openapi(deleteStepRoute, async (c) => {
    const result = await executeGoals(() =>
      service.deleteStep(c.var.user, c.req.valid('param').stepId),
    )
    return c.json(result, 200)
  })

  return routes
}
