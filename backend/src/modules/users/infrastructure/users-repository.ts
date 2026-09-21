import type { DbClient } from '../../../db'
import type { ProfileWriter } from '../application/ports'

const userSummarySelect = {
  id: true,
  email: true,
  displayName: true,
  createdAt: true,
} as const

export function createPrismaUsersRepository(db: DbClient): ProfileWriter {
  return {
    updateProfile(userId, displayName) {
      return db.user.update({
        where: { id: userId },
        data: { displayName },
        select: userSummarySelect,
      })
    },
  }
}
