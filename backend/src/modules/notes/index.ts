import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import { createPrismaNotesRepository } from './infrastructure/notes-repository'
import { createNotesRoutes } from './transport/routes'

type CreateNotesModuleOptions = {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
}

/** Notes are written and read. There is no service layer because there is nothing to coordinate. */
export function createNotesModule(options: CreateNotesModuleOptions) {
  const repository = createPrismaNotesRepository(options.db)

  return {
    routes: createNotesRoutes({ repository, requireAuth: options.requireAuth }),
    repository,
  }
}

export type { NotesRepository } from './application/ports'
