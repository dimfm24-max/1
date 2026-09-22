import type {
  CloseGoalRequest,
  CreateGoalRequest,
  CreateStageRequest,
  CreateStepRequest,
  RecordGoalProgressRequest,
  UpdateGoalRequest,
  UpdateStageRequest,
  UpdateStepRequest,
} from '@dilife/contracts'

import type { AuthenticatedPrincipal } from '../../auth'
import type { Clock, GoalsRepository } from './ports'

type GoalsServiceDependencies = {
  clock: Clock
  repository: GoalsRepository
}

/**
 * Coordination only: the repository owns ownership filtering and the writes themselves, the
 * domain owns the arithmetic. What lives here is the order of operations and the clock, so that
 * "closed at" and "completed at" come from one source rather than from each call site.
 */
export class GoalsService {
  constructor(private readonly dependencies: GoalsServiceDependencies) {}

  readTree(principal: AuthenticatedPrincipal) {
    return this.dependencies.repository.readTree(principal.id)
  }

  async upsertLifeGoal(principal: AuthenticatedPrincipal, input: { title: string }) {
    return {
      lifeGoal: await this.dependencies.repository.upsertLifeGoal(principal.id, input.title),
    }
  }

  async createGoal(principal: AuthenticatedPrincipal, input: CreateGoalRequest) {
    return { goal: await this.dependencies.repository.createGoal(principal.id, input) }
  }

  async updateGoal(
    principal: AuthenticatedPrincipal,
    goalId: string,
    input: UpdateGoalRequest,
  ) {
    return { goal: await this.dependencies.repository.updateGoal(principal.id, goalId, input) }
  }

  async recordProgress(
    principal: AuthenticatedPrincipal,
    goalId: string,
    input: RecordGoalProgressRequest,
  ) {
    return {
      goal: await this.dependencies.repository.recordProgress(
        principal.id,
        goalId,
        input.currentValue,
      ),
    }
  }

  async closeGoal(
    principal: AuthenticatedPrincipal,
    goalId: string,
    input: CloseGoalRequest,
  ) {
    return {
      goal: await this.dependencies.repository.closeGoal(
        principal.id,
        goalId,
        input,
        this.dependencies.clock.now(),
      ),
    }
  }

  async reopenGoal(
    principal: AuthenticatedPrincipal,
    goalId: string,
    input: { deadline: string },
  ) {
    return {
      goal: await this.dependencies.repository.reopenGoal(
        principal.id,
        goalId,
        new Date(input.deadline),
      ),
    }
  }

  async setPrimaryGoal(principal: AuthenticatedPrincipal, goalId: string) {
    return { goal: await this.dependencies.repository.setPrimaryGoal(principal.id, goalId) }
  }

  deleteGoal(principal: AuthenticatedPrincipal, goalId: string) {
    return this.dependencies.repository.deleteGoal(principal.id, goalId)
  }

  async createStage(
    principal: AuthenticatedPrincipal,
    goalId: string,
    input: CreateStageRequest,
  ) {
    return { goal: await this.dependencies.repository.createStage(principal.id, goalId, input) }
  }

  async updateStage(
    principal: AuthenticatedPrincipal,
    stageId: string,
    input: UpdateStageRequest,
  ) {
    return { goal: await this.dependencies.repository.updateStage(principal.id, stageId, input) }
  }

  async deleteStage(principal: AuthenticatedPrincipal, stageId: string) {
    return { goal: await this.dependencies.repository.deleteStage(principal.id, stageId) }
  }

  async createStep(
    principal: AuthenticatedPrincipal,
    stageId: string,
    input: CreateStepRequest,
  ) {
    return { goal: await this.dependencies.repository.createStep(principal.id, stageId, input) }
  }

  async updateStep(
    principal: AuthenticatedPrincipal,
    stepId: string,
    input: UpdateStepRequest,
  ) {
    return {
      goal: await this.dependencies.repository.updateStep(
        principal.id,
        stepId,
        input,
        this.dependencies.clock.now(),
      ),
    }
  }

  async deleteStep(principal: AuthenticatedPrincipal, stepId: string) {
    return { goal: await this.dependencies.repository.deleteStep(principal.id, stepId) }
  }
}
