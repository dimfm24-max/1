import { randomBytes } from 'node:crypto'

import type {
  CreateCommentRequest,
  PublicProfileResponse,
  ShareCommentDto,
  ShareSettingsDto,
  UpdateShareRequest,
} from '@dilife/contracts'

import type { DbClient } from '../../../db'
import { currentStreak } from '../../habits'
import type { SharingRepository } from '../application/ports'
import { SharingFailure } from '../domain/errors'

/**
 * 32 hex characters from a cryptographic source. The token is the whole of the permission, so it
 * has to be unguessable: a sequential id or a short code would make the page findable by trying.
 */
function newToken() {
  return randomBytes(16).toString('hex')
}

function fromDayDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function createPrismaSharingRepository(db: DbClient): SharingRepository {
  async function settingsFor(userId: string): Promise<ShareSettingsDto> {
    const link = await db.shareLink.findUnique({
      where: { userId },
      select: { token: true, showsGoals: true, showsHabits: true, showsStatistics: true },
    })
    // No row means no link: sharing is off until the person turns it on, and a page that exists
    // by default would publish work nobody chose to publish.
    return (
      link ?? { token: null, showsGoals: true, showsHabits: false, showsStatistics: false }
    )
  }

  return {
    settingsFor,

    async enable(userId) {
      const link = await db.shareLink.upsert({
        where: { userId },
        create: { userId, token: newToken() },
        // Re-enabling keeps the existing address, so a link already given to someone does not
        // silently become a second one.
        update: {},
        select: { token: true, showsGoals: true, showsHabits: true, showsStatistics: true },
      })
      return link
    },

    async rotate(userId) {
      const link = await db.shareLink.upsert({
        where: { userId },
        create: { userId, token: newToken() },
        // A new address, and the old one stops working immediately - that is what revoking means.
        update: { token: newToken() },
        select: { token: true, showsGoals: true, showsHabits: true, showsStatistics: true },
      })
      return link
    },

    async disable(userId) {
      // Deleting takes the comments with it: they were left on a page that no longer exists.
      await db.shareLink.deleteMany({ where: { userId } })
      return settingsFor(userId)
    },

    async updateSettings(userId, input: UpdateShareRequest) {
      const existing = await db.shareLink.findUnique({
        where: { userId },
        select: { id: true },
      })
      if (!existing) throw new SharingFailure('not_found', 'Sharing is not enabled')

      await db.shareLink.update({
        where: { userId },
        data: {
          ...(input.showsGoals === undefined ? {} : { showsGoals: input.showsGoals }),
          ...(input.showsHabits === undefined ? {} : { showsHabits: input.showsHabits }),
          ...(input.showsStatistics === undefined
            ? {}
            : { showsStatistics: input.showsStatistics }),
        },
      })
      return settingsFor(userId)
    },

    async ownerOf(token) {
      const link = await db.shareLink.findUnique({ where: { token }, select: { userId: true } })
      return link?.userId ?? null
    },

    async readPublicProfile(token, today): Promise<PublicProfileResponse> {
      const link = await db.shareLink.findUnique({
        where: { token },
        select: {
          id: true,
          showsGoals: true,
          showsHabits: true,
          showsStatistics: true,
          user: {
            select: {
              displayName: true,
              lifeGoal: { select: { title: true, deletedAt: true } },
              goals: {
                // Nothing from the trash reaches the public page.
                where: { isPrivate: false, deletedAt: null },
                orderBy: [{ status: 'asc' }, { position: 'asc' }],
                select: {
                  id: true,
                  title: true,
                  deadline: true,
                  measureUnit: true,
                  targetValue: true,
                  currentValue: true,
                  status: true,
                  stages: {
                    where: { deletedAt: null },
                    select: {
                      steps: { where: { deletedAt: null }, select: { completedAt: true } },
                    },
                  },
                },
              },
              habits: {
                where: { archivedAt: null, deletedAt: null },
                orderBy: { position: 'asc' },
                select: {
                  id: true,
                  title: true,
                  schedule: true,
                  weekdays: true,
                  intervalDays: true,
                  startedOn: true,
                  marks: { select: { markedOn: true } },
                },
              },
              tasks: {
                where: { outcome: 'done', deletedAt: null },
                select: { scheduledOn: true },
              },
            },
          },
          comments: {
            orderBy: { createdAt: 'asc' },
            select: { id: true, authorName: true, body: true, createdAt: true },
          },
        },
      })
      if (!link) throw new SharingFailure('not_found', 'No such page')

      const user = link.user
      const goals = link.showsGoals
        ? user.goals.map((goal) => {
            const steps = goal.stages.flatMap((stage) => stage.steps)
            return {
              id: goal.id,
              title: goal.title,
              // A date column: its UTC date part is the calendar day that was stored.
              deadline: goal.deadline.toISOString().slice(0, 10),
              measureUnit: goal.measureUnit,
              targetValue: Number(goal.targetValue.toString()),
              currentValue: Number(goal.currentValue.toString()),
              status: goal.status,
              completedSteps: steps.filter((step) => step.completedAt !== null).length,
              totalSteps: steps.length,
            }
          })
        : null

      const habits = link.showsHabits
        ? user.habits.map((habit) => ({
            id: habit.id,
            title: habit.title,
            currentStreak: currentStreak(
              {
                schedule: habit.schedule,
                weekdays: habit.weekdays,
                intervalDays: habit.intervalDays,
                startedOn: fromDayDate(habit.startedOn),
              },
              new Set(habit.marks.map((mark) => fromDayDate(mark.markedOn))),
              today,
            ),
          }))
        : null

      const statistics = link.showsStatistics
        ? {
            done: user.tasks.length,
            activeDays: new Set(user.tasks.map((task) => fromDayDate(task.scheduledOn))).size,
          }
        : null

      return {
        // The display name only. No email and no id: the page says who is doing the work, not
        // how to reach them or which account they are.
        displayName: user.displayName,
        lifeGoalTitle:
          user.lifeGoal && user.lifeGoal.deletedAt === null ? user.lifeGoal.title : null,
        goals,
        habits,
        statistics,
        comments: link.comments.map(toCommentDto),
      }
    },

    async addComment(token, input: CreateCommentRequest) {
      const link = await db.shareLink.findUnique({ where: { token }, select: { id: true } })
      if (!link) throw new SharingFailure('not_found', 'No such page')

      await db.shareComment.create({
        data: { shareLinkId: link.id, authorName: input.authorName, body: input.body },
      })
      const comments = await db.shareComment.findMany({
        where: { shareLinkId: link.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, authorName: true, body: true, createdAt: true },
      })
      return comments.map(toCommentDto)
    },

    async deleteComment(userId, commentId) {
      // Scoped through the owner's own link, so one person cannot delete another page's comments.
      const deleted = await db.shareComment.deleteMany({
        where: { id: commentId, shareLink: { userId } },
      })
      if (deleted.count === 0) throw new SharingFailure('not_found', 'Comment not found')

      const comments = await db.shareComment.findMany({
        where: { shareLink: { userId } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, authorName: true, body: true, createdAt: true },
      })
      return comments.map(toCommentDto)
    },
  }
}

function toCommentDto(row: {
  id: string
  authorName: string
  body: string
  createdAt: Date
}): ShareCommentDto {
  return {
    id: row.id,
    authorName: row.authorName,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  }
}
