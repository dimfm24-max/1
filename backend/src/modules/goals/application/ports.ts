import type {
  CloseGoalRequest,
  CreateGoalRequest,
  CreateStageRequest,
  CreateStepRequest,
  GoalDto,
  GoalTreeResponse,
  LifeGoalDto,
  UpdateGoalRequest,
  UpdateStageRequest,
  UpdateStepRequest,
} from '@dilife/contracts'

/**
 * Every port takes the owner id. The repository filters on it in the same query that finds the
 * row, so a row belonging to someone else is not found rather than found and then refused -
 * there is no window in which the wrong row is loaded.
 */
export type GoalsRepository = {
  readTree(userId: string): Promise<GoalTreeResponse>
  upsertLifeGoal(userId: string, title: string): Promise<LifeGoalDto>
  createGoal(userId: string, input: CreateGoalRequest): Promise<GoalDto>
  updateGoal(userId: string, goalId: string, input: UpdateGoalRequest): Promise<GoalDto>
  recordProgress(userId: string, goalId: string, currentValue: number): Promise<GoalDto>
  closeGoal(
    userId: string,
    goalId: string,
    input: CloseGoalRequest,
    now: Date,
  ): Promise<GoalDto>
  reopenGoal(userId: string, goalId: string, deadline: Date): Promise<GoalDto>
  setPrimaryGoal(userId: string, goalId: string): Promise<GoalDto>
  deleteGoal(userId: string, goalId: string): Promise<void>
  createStage(userId: string, goalId: string, input: CreateStageRequest): Promise<GoalDto>
  updateStage(userId: string, stageId: string, input: UpdateStageRequest): Promise<GoalDto>
  deleteStage(userId: string, stageId: string): Promise<GoalDto>
  createStep(userId: string, stageId: string, input: CreateStepRequest): Promise<GoalDto>
  updateStep(
    userId: string,
    stepId: string,
    input: UpdateStepRequest,
    now: Date,
  ): Promise<GoalDto>
  deleteStep(userId: string, stepId: string): Promise<GoalDto>
}

export type Clock = {
  now(): Date
}
