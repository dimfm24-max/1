import type { DbClient } from '../../../db'
import { countClaimableTasks, enqueueTask } from '../../../outbox'
import {
  emailVerificationTaskType,
  type EmailVerificationTaskQueue,
} from '../application/ports'

/**
 * The ceiling works like the password reset one (`password-reset-task-queue.ts`): only rows the
 * next drain pass can claim count, and the limit is one drain pass. Each of the two anonymous
 * letter types has its own ceiling, so a flood of one delays the other by one pass at most.
 */
export function createEmailVerificationTaskQueue(
  prisma: Pick<DbClient, 'taskOutbox'>,
  { pendingLimit }: { pendingLimit: number },
): EmailVerificationTaskQueue {
  return {
    hasRoom: async (now) =>
      (await countClaimableTasks(prisma, { now, types: [emailVerificationTaskType] })) <
      pendingLimit,
    enqueue: async (task) => {
      await enqueueTask(prisma, task)
    },
  }
}
