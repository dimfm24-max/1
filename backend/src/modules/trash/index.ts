import type { MiddlewareHandler } from 'hono'

import type { DbClient } from '../../db'
import type { AuthHttpEnv } from '../auth'
import { createDayTrashSource } from '../day'
import { createGoalsTrashSource } from '../goals'
import { createHabitsTrashSource } from '../habits'
import { createNotesTrashSource } from '../notes'
import { purgeExpiredTrash, TrashService, type TrashSource } from './application/trash-service'
import { createTrashRoutes } from './transport/routes'

/** Every module that deletes through the trash (owner's decision on task 11). */
export function createTrashSources(db: DbClient): TrashSource[] {
  return [
    createGoalsTrashSource(db),
    createDayTrashSource(db),
    createNotesTrashSource(db),
    createHabitsTrashSource(db),
  ] as TrashSource[]
}

export function createTrashModule(options: {
  db: DbClient
  requireAuth: MiddlewareHandler<AuthHttpEnv>
  clock?: { now(): Date }
}) {
  const service = new TrashService({
    clock: options.clock ?? { now: () => new Date() },
    sources: createTrashSources(options.db),
  })
  return {
    routes: createTrashRoutes({ requireAuth: options.requireAuth, service }),
    service,
  }
}

/** The 30-day sweep for `maintenance:process`. */
export function purgeExpiredTrashItems(db: DbClient, now: Date) {
  return purgeExpiredTrash(createTrashSources(db), now)
}

export { trashCutoff } from './application/trash-service'
