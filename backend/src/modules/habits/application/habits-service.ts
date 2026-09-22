import type {
  CreateHabitRequest,
  MarkHabitRequest,
  UpdateHabitRequest,
} from '@dilife/contracts'

import type { AuthenticatedPrincipal } from '../../auth'
import type { Clock, HabitsRepository } from './ports'

type HabitsServiceDependencies = {
  clock: Clock
  repository: HabitsRepository
}

/**
 * Coordination only. Streaks need to know what "today" is, and the client says so: the person's
 * own day boundary decides whether a habit is still open, not the server's time zone.
 */
export class HabitsService {
  constructor(private readonly dependencies: HabitsServiceDependencies) {}

  async list(principal: AuthenticatedPrincipal, today: string) {
    return { habits: await this.dependencies.repository.list(principal.id, today) }
  }

  async create(
    principal: AuthenticatedPrincipal,
    input: CreateHabitRequest,
    today: string,
  ) {
    return { habit: await this.dependencies.repository.create(principal.id, input, today) }
  }

  async update(
    principal: AuthenticatedPrincipal,
    habitId: string,
    input: UpdateHabitRequest,
    today: string,
  ) {
    return {
      habit: await this.dependencies.repository.update(
        principal.id,
        habitId,
        input,
        today,
        this.dependencies.clock.now(),
      ),
    }
  }

  async mark(
    principal: AuthenticatedPrincipal,
    habitId: string,
    input: MarkHabitRequest,
    today: string,
  ) {
    return { habit: await this.dependencies.repository.mark(principal.id, habitId, input, today) }
  }

  async remove(principal: AuthenticatedPrincipal, habitId: string, today: string) {
    return { habits: await this.dependencies.repository.remove(principal.id, habitId, today) }
  }
}
