import type { DbClient } from '../src/db'
import {
  bootstrapDevelopmentAccounts,
  type DevelopmentSeedAccounts,
} from '../src/modules/users/infrastructure/development-bootstrap'

export async function bootstrapDevelopmentData(
  db: DbClient,
  accounts: DevelopmentSeedAccounts,
) {
  const seeded = await bootstrapDevelopmentAccounts(db, accounts)

  return {
    user: { email: seeded.user.email },
  }
}
