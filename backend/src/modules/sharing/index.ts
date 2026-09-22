import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import { createPrismaSharingRepository } from './infrastructure/sharing-repository'
import { createSharingRoutes } from './transport/routes'

type CreateSharingModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
}

/**
 * Sharing has a public half and a private one in the same module, because they are two views of
 * one decision: what this person chose to show.
 */
export function createSharingModule(options: CreateSharingModuleOptions) {
  const repository = createPrismaSharingRepository(options.db)

  return {
    routes: createSharingRoutes({ repository, requireAuth: options.requireAuth }),
    repository,
  }
}

export type { SharingRepository } from './application/ports'
