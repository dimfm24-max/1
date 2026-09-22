import {
  apiErrorSchema,
  applyTemplateRequestSchema,
  categoriesResponseSchema,
  categoryIdParamsSchema,
  createCategoryRequestSchema,
  createSubtaskRequestSchema,
  createTaskRequestSchema,
  createTemplateItemRequestSchema,
  createTemplateRequestSchema,
  dayContextResponseSchema,
  dayParamsSchema,
  dayResponseSchema,
  resolveTaskRequestSchema,
  settingsResponseSchema,
  subtaskIdParamsSchema,
  taskIdParamsSchema,
  taskResponseSchema,
  templateIdParamsSchema,
  templateItemIdParamsSchema,
  templatesResponseSchema,
  updateCategoryRequestSchema,
  updateSettingsRequestSchema,
  updateSubtaskRequestSchema,
  updateTaskRequestSchema,
} from '@dilife/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'

import { validationErrorHook } from '../../../http/errors'
import { ingressErrorResponses } from '../../../http/openapi'
import type { AuthHttpEnv } from '../../auth'
import type { DayService } from '../application/day-service'
import { executeDay } from './errors'

const errorContent = { 'application/json': { schema: apiErrorSchema } }
const bearerSecurity = [{ BearerAuth: [] }]

const commonErrors = {
  ...ingressErrorResponses,
  400: { content: errorContent, description: 'Invalid payload' },
  401: { content: errorContent, description: 'Authentication required' },
}

const withNotFound = {
  ...commonErrors,
  404: { content: errorContent, description: 'No such row for this account' },
}

const taskOk = {
  200: {
    content: { 'application/json': { schema: taskResponseSchema } },
    description: 'The task as it now stands',
  },
}

const readDayRoute = createRoute({
  method: 'get',
  path: '/{date}',
  security: bearerSecurity,
  request: { params: dayParamsSchema },
  responses: {
    ...commonErrors,
    200: {
      content: { 'application/json': { schema: dayResponseSchema } },
      description: 'Everything planned for that day',
    },
  },
})

const readContextRoute = createRoute({
  method: 'get',
  path: '/context',
  security: bearerSecurity,
  responses: {
    ...commonErrors,
    200: {
      content: { 'application/json': { schema: dayContextResponseSchema } },
      description: 'Settings, categories and templates the day screen reads',
    },
  },
})

const createTaskRoute = createRoute({
  method: 'post',
  path: '/tasks',
  security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: createTaskRequestSchema } } } },
  responses: {
    ...withNotFound,
    201: {
      content: { 'application/json': { schema: taskResponseSchema } },
      description: 'The created task',
    },
  },
})

const updateTaskRoute = createRoute({
  method: 'patch',
  path: '/tasks/{taskId}',
  security: bearerSecurity,
  request: {
    params: taskIdParamsSchema,
    body: { content: { 'application/json': { schema: updateTaskRequestSchema } } },
  },
  responses: { ...withNotFound, ...taskOk },
})

const resolveTaskRoute = createRoute({
  method: 'post',
  path: '/tasks/{taskId}/resolve',
  security: bearerSecurity,
  request: {
    params: taskIdParamsSchema,
    body: { content: { 'application/json': { schema: resolveTaskRequestSchema } } },
  },
  responses: {
    ...withNotFound,
    ...taskOk,
    409: { content: errorContent, description: 'The task is already done' },
  },
})

const deleteTaskRoute = createRoute({
  method: 'delete',
  path: '/tasks/{taskId}',
  security: bearerSecurity,
  request: { params: taskIdParamsSchema },
  responses: {
    ...withNotFound,
    200: {
      content: { 'application/json': { schema: dayResponseSchema } },
      description: 'The day without that task',
    },
  },
})

const createSubtaskRoute = createRoute({
  method: 'post',
  path: '/tasks/{taskId}/subtasks',
  security: bearerSecurity,
  request: {
    params: taskIdParamsSchema,
    body: { content: { 'application/json': { schema: createSubtaskRequestSchema } } },
  },
  responses: { ...withNotFound, ...taskOk },
})

const updateSubtaskRoute = createRoute({
  method: 'patch',
  path: '/subtasks/{subtaskId}',
  security: bearerSecurity,
  request: {
    params: subtaskIdParamsSchema,
    body: { content: { 'application/json': { schema: updateSubtaskRequestSchema } } },
  },
  responses: { ...withNotFound, ...taskOk },
})

const deleteSubtaskRoute = createRoute({
  method: 'delete',
  path: '/subtasks/{subtaskId}',
  security: bearerSecurity,
  request: { params: subtaskIdParamsSchema },
  responses: { ...withNotFound, ...taskOk },
})

const updateSettingsRoute = createRoute({
  method: 'patch',
  path: '/settings',
  security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: updateSettingsRequestSchema } } } },
  responses: {
    ...commonErrors,
    200: {
      content: { 'application/json': { schema: settingsResponseSchema } },
      description: 'The settings as they now stand',
    },
  },
})

const categoriesOk = {
  200: {
    content: { 'application/json': { schema: categoriesResponseSchema } },
    description: 'Every category, in order',
  },
}

const createCategoryRoute = createRoute({
  method: 'post',
  path: '/categories',
  security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: createCategoryRequestSchema } } } },
  responses: { ...commonErrors, ...categoriesOk },
})

const updateCategoryRoute = createRoute({
  method: 'patch',
  path: '/categories/{categoryId}',
  security: bearerSecurity,
  request: {
    params: categoryIdParamsSchema,
    body: { content: { 'application/json': { schema: updateCategoryRequestSchema } } },
  },
  responses: { ...withNotFound, ...categoriesOk },
})

const deleteCategoryRoute = createRoute({
  method: 'delete',
  path: '/categories/{categoryId}',
  security: bearerSecurity,
  request: { params: categoryIdParamsSchema },
  responses: { ...withNotFound, ...categoriesOk },
})

const templatesOk = {
  200: {
    content: { 'application/json': { schema: templatesResponseSchema } },
    description: 'Every day template, in order',
  },
}

const createTemplateRoute = createRoute({
  method: 'post',
  path: '/templates',
  security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: createTemplateRequestSchema } } } },
  responses: { ...commonErrors, ...templatesOk },
})

const deleteTemplateRoute = createRoute({
  method: 'delete',
  path: '/templates/{templateId}',
  security: bearerSecurity,
  request: { params: templateIdParamsSchema },
  responses: { ...withNotFound, ...templatesOk },
})

const createTemplateItemRoute = createRoute({
  method: 'post',
  path: '/templates/{templateId}/items',
  security: bearerSecurity,
  request: {
    params: templateIdParamsSchema,
    body: { content: { 'application/json': { schema: createTemplateItemRequestSchema } } },
  },
  responses: { ...withNotFound, ...templatesOk },
})

const deleteTemplateItemRoute = createRoute({
  method: 'delete',
  path: '/template-items/{itemId}',
  security: bearerSecurity,
  request: { params: templateItemIdParamsSchema },
  responses: { ...withNotFound, ...templatesOk },
})

const applyTemplateRoute = createRoute({
  method: 'post',
  path: '/templates/apply',
  security: bearerSecurity,
  request: { body: { content: { 'application/json': { schema: applyTemplateRequestSchema } } } },
  responses: {
    ...withNotFound,
    200: {
      content: { 'application/json': { schema: dayResponseSchema } },
      description: 'The day with the template added to it',
    },
  },
})

type CreateDayRoutesOptions = {
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  service: DayService
}

export function createDayRoutes({ requireAuth, service }: CreateDayRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })

  routes.use('*', requireAuth)

  // Registered before `/{date}`, which would otherwise match the literal path first.
  routes.openapi(readContextRoute, async (c) => {
    return c.json(await executeDay(() => service.readContext(c.var.user)), 200)
  })

  routes.openapi(createTaskRoute, async (c) => {
    const result = await executeDay(() => service.createTask(c.var.user, c.req.valid('json')))
    return c.json(result, 201)
  })

  routes.openapi(updateTaskRoute, async (c) => {
    const result = await executeDay(() =>
      service.updateTask(c.var.user, c.req.valid('param').taskId, c.req.valid('json')),
    )
    return c.json(result, 200)
  })

  routes.openapi(resolveTaskRoute, async (c) => {
    const result = await executeDay(() =>
      service.resolveTask(c.var.user, c.req.valid('param').taskId, c.req.valid('json')),
    )
    return c.json(result, 200)
  })

  routes.openapi(deleteTaskRoute, async (c) => {
    const day = await executeDay(() =>
      service.deleteTask(c.var.user, c.req.valid('param').taskId),
    )
    return c.json(day, 200)
  })

  routes.openapi(createSubtaskRoute, async (c) => {
    const result = await executeDay(() =>
      service.createSubtask(c.var.user, c.req.valid('param').taskId, c.req.valid('json')),
    )
    return c.json(result, 200)
  })

  routes.openapi(updateSubtaskRoute, async (c) => {
    const result = await executeDay(() =>
      service.updateSubtask(c.var.user, c.req.valid('param').subtaskId, c.req.valid('json')),
    )
    return c.json(result, 200)
  })

  routes.openapi(deleteSubtaskRoute, async (c) => {
    const result = await executeDay(() =>
      service.deleteSubtask(c.var.user, c.req.valid('param').subtaskId),
    )
    return c.json(result, 200)
  })

  routes.openapi(updateSettingsRoute, async (c) => {
    const result = await executeDay(() =>
      service.updateSettings(c.var.user, c.req.valid('json')),
    )
    return c.json(result, 200)
  })

  routes.openapi(createCategoryRoute, async (c) => {
    const result = await executeDay(() => service.createCategory(c.var.user, c.req.valid('json')))
    return c.json(result, 200)
  })

  routes.openapi(updateCategoryRoute, async (c) => {
    const result = await executeDay(() =>
      service.updateCategory(c.var.user, c.req.valid('param').categoryId, c.req.valid('json')),
    )
    return c.json(result, 200)
  })

  routes.openapi(deleteCategoryRoute, async (c) => {
    const result = await executeDay(() =>
      service.deleteCategory(c.var.user, c.req.valid('param').categoryId),
    )
    return c.json(result, 200)
  })

  routes.openapi(applyTemplateRoute, async (c) => {
    const result = await executeDay(() => service.applyTemplate(c.var.user, c.req.valid('json')))
    return c.json(result, 200)
  })

  routes.openapi(createTemplateRoute, async (c) => {
    const result = await executeDay(() => service.createTemplate(c.var.user, c.req.valid('json')))
    return c.json(result, 200)
  })

  routes.openapi(deleteTemplateRoute, async (c) => {
    const result = await executeDay(() =>
      service.deleteTemplate(c.var.user, c.req.valid('param').templateId),
    )
    return c.json(result, 200)
  })

  routes.openapi(createTemplateItemRoute, async (c) => {
    const result = await executeDay(() =>
      service.createTemplateItem(c.var.user, c.req.valid('param').templateId, c.req.valid('json')),
    )
    return c.json(result, 200)
  })

  routes.openapi(deleteTemplateItemRoute, async (c) => {
    const result = await executeDay(() =>
      service.deleteTemplateItem(c.var.user, c.req.valid('param').itemId),
    )
    return c.json(result, 200)
  })

  routes.openapi(readDayRoute, async (c) => {
    const result = await executeDay(() =>
      service.readDay(c.var.user, c.req.valid('param').date),
    )
    return c.json(result, 200)
  })

  return routes
}
