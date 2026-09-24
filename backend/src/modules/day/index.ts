import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import type { SettingsReader } from '../settings'
import { DayService } from './application/day-service'
import { createPrismaDayRepository } from './infrastructure/day-repository'
export { materializeUpcomingPlans } from './infrastructure/day-repository'
import { createDayRoutes } from './transport/routes'

type CreateDayModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  settings: SettingsReader
}

export function createDayModule(options: CreateDayModuleOptions) {
  const service = new DayService({
    clock: { now: () => new Date() },
    repository: createPrismaDayRepository(options.db),
    settings: options.settings,
  })

  return {
    routes: createDayRoutes({ requireAuth: options.requireAuth, service }),
    service,
  }
}

export { DayService } from './application/day-service'
export type { DayRepository } from './application/ports'
export { createDayTrashSource } from './infrastructure/day-trash'
