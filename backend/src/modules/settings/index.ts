import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import { SettingsService } from './application/settings-service'
import { createPrismaSettingsRepository } from './infrastructure/settings-repository'
import { createSettingsRoutes } from './transport/routes'

type CreateSettingsModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  clock?: { now(): Date }
}

export function createSettingsModule(options: CreateSettingsModuleOptions) {
  const service = new SettingsService({
    clock: options.clock ?? { now: () => new Date() },
    repository: createPrismaSettingsRepository(options.db),
  })

  return {
    routes: createSettingsRoutes({ requireAuth: options.requireAuth, service }),
    service,
  }
}

/**
 * What other modules may ask of settings: the preferences themselves and which day it is for a
 * person. Passed in at construction, so no other module reads the settings table on its own.
 */
export type SettingsReader = Pick<SettingsService, 'read' | 'today' | 'clockFor' | 'update'>

export { SettingsService } from './application/settings-service'
export { executeSettings, toSettingsAppError } from './transport/errors'
export {
  daysBetween,
  effectiveTimeZone,
  FALLBACK_TIME_ZONE,
  isKnownTimeZone,
  planDate,
  shiftDate,
  wallClock,
} from './domain/local-day'
