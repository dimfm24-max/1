import type {
  CloseGoalRequest,
  CreateGoalRequest,
  CreateStageRequest,
  CreateStepRequest,
  DeleteLifeGoalRequest,
  RecordGoalProgressRequest,
  UpdateGoalRequest,
  UpdateStageRequest,
  UpdateStepRequest,
} from '@dilife/contracts'

import type { AuthenticatedPrincipal } from '../../auth'
import type { Clock, GoalsRepository, TodayReader } from './ports'

type GoalsServiceDependencies = {
  clock: Clock
  repository: GoalsRepository
  today: TodayReader
}

/**
 * Coordination only: the repository owns ownership filtering and the writes themselves, the
 * domain owns the arithmetic. What lives here is the order of operations, the clock and the
 * person's "today", so that "closed at" and "not in the past" come from one source.
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

  deleteLifeGoal(principal: AuthenticatedPrincipal, input: DeleteLifeGoalRequest) {
    return this.dependencies.repository.deleteLifeGoal(
      principal.id,
      input.goals,
      this.dependencies.clock.now(),
    )
  }

  async createGoal(principal: AuthenticatedPrincipal, input: CreateGoalRequest) {
    const today = await this.dependencies.today(principal.id)
    return { goal: await this.dependencies.repository.createGoal(principal.id, input, today) }
  }

  async updateGoal(
    principal: AuthenticatedPrincipal,
    goalId: string,
    input: UpdateGoalRequest,
  ) {
    const today = await this.dependencies.today(principal.id)
    return {
      goal: await this.dependencies.repository.updateGoal(principal.id, goalId, input, today),
    }
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

  async readProgressHistory(principal: AuthenticatedPrincipal, goalId: string) {
    return {
      entries: await this.dependencies.repository.readProgressHistory(principal.id, goalId),
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
    const today = await this.dependencies.today(principal.id)
    return {
      goal: await this.dependencies.repository.reopenGoal(
        principal.id,
        goalId,
        input.deadline,
        today,
      ),
    }
  }

  async setPrimaryGoal(principal: AuthenticatedPrincipal, goalId: string) {
    return { goal: await this.dependencies.repository.setPrimaryGoal(principal.id, goalId) }
  }

  deleteGoal(principal: AuthenticatedPrincipal, goalId: string) {
    return this.dependencies.repository.trashGoal(
      principal.id,
      goalId,
      this.dependencies.clock.now(),
    )
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
    return {
      goal: await this.dependencies.repository.trashStage(
        principal.id,
        stageId,
        this.dependencies.clock.now(),
      ),
    }
  }

  async reorderStages(principal: AuthenticatedPrincipal, goalId: string, ids: string[]) {
    return { goal: await this.dependencies.repository.reorderStages(principal.id, goalId, ids) }
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
    return {
      goal: await this.dependencies.repository.trashStep(
        principal.id,
        stepId,
        this.dependencies.clock.now(),
      ),
    }
  }

  async reorderSteps(principal: AuthenticatedPrincipal, stageId: string, ids: string[]) {
    return { goal: await this.dependencies.repository.reorderSteps(principal.id, stageId, ids) }
  }
}
