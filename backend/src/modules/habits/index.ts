import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import type { SettingsReader } from '../settings'
import { HabitsService } from './application/habits-service'
import { createPrismaHabitsRepository } from './infrastructure/habits-repository'
import { createHabitsRoutes } from './transport/routes'

type CreateHabitsModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  settings: SettingsReader
}

export function createHabitsModule(options: CreateHabitsModuleOptions) {
  const service = new HabitsService({
    clock: { now: () => new Date() },
    repository: createPrismaHabitsRepository(options.db),
    settings: options.settings,
  })

  return {
    routes: createHabitsRoutes({ requireAuth: options.requireAuth, service }),
    service,
  }
}

export { HabitsService } from './application/habits-service'
export type { HabitsRepository } from './application/ports'
export { currentStreak, isDueOn, longestStreak } from './domain/streak'
export { createHabitsTrashSource } from './infrastructure/habits-trash'
