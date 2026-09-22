import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import { DayService } from './application/day-service'
import { createPrismaDayRepository } from './infrastructure/day-repository'
import { createDayRoutes } from './transport/routes'

type CreateDayModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
}

export function createDayModule(options: CreateDayModuleOptions) {
  const service = new DayService({
    clock: { now: () => new Date() },
    repository: createPrismaDayRepository(options.db),
  })

  return {
    routes: createDayRoutes({ requireAuth: options.requireAuth, service }),
    service,
  }
}

export { DayService } from './application/day-service'
export type { DayRepository } from './application/ports'
export { findOverlaps, suggestStartMinute, summariseDay } from './domain/schedule'
