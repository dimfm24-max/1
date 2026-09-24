import type {
  CreateHabitRequest,
  MarkHabitRequest,
  UpdateHabitRequest,
} from '@dilife/contracts'

import type { AuthenticatedPrincipal } from '../../auth'
import type { SettingsReader } from '../../settings'
import type { Clock, HabitsRepository } from './ports'

type HabitsServiceDependencies = {
  clock: Clock
  repository: HabitsRepository
  settings: SettingsReader
}

/**
 * Coordination only. Streaks need to know what "today" is, and the settings module answers by
 * the person's own zone and day start, not by the server clock or the browser's.
 */
export class HabitsService {
  constructor(private readonly dependencies: HabitsServiceDependencies) {}

  private today(principal: AuthenticatedPrincipal) {
    return this.dependencies.settings.today(principal.id)
  }

  async list(principal: AuthenticatedPrincipal) {
    const today = await this.today(principal)
    return { habits: await this.dependencies.repository.list(principal.id, today) }
  }

  async create(
    principal: AuthenticatedPrincipal,
    input: CreateHabitRequest,
  ) {
    const today = await this.today(principal)
    return { habit: await this.dependencies.repository.create(principal.id, input, today) }
  }

  async update(
    principal: AuthenticatedPrincipal,
    habitId: string,
    input: UpdateHabitRequest,
  ) {
    const today = await this.today(principal)
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
  ) {
    const today = await this.today(principal)
    return { habit: await this.dependencies.repository.mark(principal.id, habitId, input, today) }
  }

  async remove(principal: AuthenticatedPrincipal, habitId: string) {
    const today = await this.today(principal)
    return {
      habits: await this.dependencies.repository.remove(
        principal.id,
        habitId,
        today,
        this.dependencies.clock.now(),
      ),
    }
  }
}
