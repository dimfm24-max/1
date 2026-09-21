import {
  acquirePushTokenUserLock,
  acquireUserAuthenticationAuthorityLock,
  type DbClient,
  userAuthorityTransitionTransactionOptions,
} from '../../../db'
import { Prisma } from '../../../generated/prisma/client'

export type DevelopmentSeedAccounts = {
  user: DevelopmentSeedCredentials
}

type DevelopmentSeedCredentials = {
  email: string
  password: string
}

export async function bootstrapDevelopmentAccounts(
  db: DbClient,
  accounts: DevelopmentSeedAccounts,
) {
  const user = await bootstrapDevelopmentUser(db, accounts.user)

  return {
    user: { email: user.email, id: user.id },
  }
}

async function bootstrapDevelopmentUser(
  db: DbClient,
  credentials: DevelopmentSeedAccounts['user'],
) {
  for (;;) {
    const existing = await db.user.findUnique({
      where: { email: credentials.email },
      select: { id: true, passwordHash: true },
    })
    if (existing) {
      return updateExistingDevelopmentUser(db, existing, credentials)
    }

    try {
      return await db.user.create({
        data: {
          displayName: 'Development User',
          email: credentials.email,
          passwordHash: await Bun.password.hash(credentials.password, { algorithm: 'argon2id' }),
        },
        select: { email: true, id: true },
      })
    } catch (error) {
      if (!isUniqueConstraintFailure(error)) throw error
      // Another seed created this email; retry through the fenced update path.
    }
  }
}

async function updateExistingDevelopmentUser(
  db: DbClient,
  existing: { id: string; passwordHash: string | null },
  credentials: DevelopmentSeedAccounts['user'],
) {
  if (
    existing.passwordHash !== null &&
    await matchesPassword(credentials.password, existing.passwordHash)
  ) {
    return { email: credentials.email, id: existing.id }
  }

  const requestedPasswordHash = await Bun.password.hash(credentials.password, {
    algorithm: 'argon2id',
  })
  return db.$transaction(async (tx) => {
    await acquirePushTokenUserLock(tx, existing.id)
    await acquireUserAuthenticationAuthorityLock(tx, existing.id)
    const current = await tx.user.findUniqueOrThrow({
      where: { id: existing.id },
      select: { passwordHash: true },
    })
    if (
      current.passwordHash !== null &&
      await matchesPassword(credentials.password, current.passwordHash)
    ) {
      return { email: credentials.email, id: existing.id }
    }

    const now = new Date()
    const updated = await tx.user.update({
      where: { id: existing.id },
      data: { passwordHash: requestedPasswordHash },
      select: { email: true, id: true },
    })
    await tx.authSession.updateMany({
      where: { userId: existing.id, revokedAt: null },
      data: { revokedAt: now },
    })
    await tx.passwordResetToken.updateMany({
      where: { userId: existing.id, usedAt: null },
      data: { usedAt: now },
    })
    await tx.pushToken.deleteMany({ where: { userId: existing.id } })
    return updated
  }, userAuthorityTransitionTransactionOptions)
}

function isUniqueConstraintFailure(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

async function matchesPassword(password: string, passwordHash: string) {
  try {
    return await Bun.password.verify(password, passwordHash)
  } catch {
    return false
  }
}
