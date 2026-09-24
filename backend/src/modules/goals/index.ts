import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import { GoalsService } from './application/goals-service'
import type { TodayReader } from './application/ports'
import { createPrismaGoalsRepository } from './infrastructure/goals-repository'
import { createGoalsRoutes } from './transport/routes'

type CreateGoalsModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  /** The person's "today" for the "no deadline in the past" rule. */
  today: TodayReader
  clock?: { now(): Date }
}

export function createGoalsModule(options: CreateGoalsModuleOptions) {
  const service = new GoalsService({
    clock: options.clock ?? { now: () => new Date() },
    repository: createPrismaGoalsRepository(options.db),
    today: options.today,
  })

  return {
    routes: createGoalsRoutes({ requireAuth: options.requireAuth, service }),
    service,
  }
}

export { GoalsService } from './application/goals-service'
export type { GoalsRepository } from './application/ports'
export { automaticProgressValue, daysUntil, goalCompletionRatio, goalRatio } from './domain/progress'
export { createGoalsTrashSource } from './infrastructure/goals-trash'
