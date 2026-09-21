import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import { UsersService } from './application/users-service'
import { createPrismaUsersRepository } from './infrastructure/users-repository'
import { createUsersRoutes } from './transport/routes'

type CreateUsersModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
}

export function createUsersModule(options: CreateUsersModuleOptions) {
  const repository = createPrismaUsersRepository(options.db)
  const service = new UsersService({ profileWriter: repository })
  return createUsersRoutes({
    requireAuth: options.requireAuth,
    service,
  })
}
