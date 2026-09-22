import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import { GoalsService } from './application/goals-service'
import { createPrismaGoalsRepository } from './infrastructure/goals-repository'
import { createGoalsRoutes } from './transport/routes'

type CreateGoalsModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
}

export function createGoalsModule(options: CreateGoalsModuleOptions) {
  const service = new GoalsService({
    clock: { now: () => new Date() },
    repository: createPrismaGoalsRepository(options.db),
  })

  return {
    routes: createGoalsRoutes({ requireAuth: options.requireAuth, service }),
    service,
  }
}

export { GoalsService } from './application/goals-service'
export type { GoalsRepository } from './application/ports'
export { automaticProgressValue, daysUntil, goalCompletionRatio } from './domain/progress'
