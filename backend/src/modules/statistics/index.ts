import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import { createPrismaStatisticsRepository } from './infrastructure/statistics-repository'
import { createStatisticsRoutes } from './transport/routes'

type CreateStatisticsModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
}

/**
 * Read-only: statistics own no rows of their own, they count what the day, goals and habits
 * already wrote. There is no service layer because there is nothing to coordinate.
 */
export function createStatisticsModule(options: CreateStatisticsModuleOptions) {
  const repository = createPrismaStatisticsRepository(options.db)

  return {
    routes: createStatisticsRoutes({ reader: repository, requireAuth: options.requireAuth }),
    reader: repository,
  }
}

export type { StatisticsReader } from './application/ports'
export { eachDay, periodWindow } from './domain/window'
