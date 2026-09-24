import type {
  CloseGoalRequest,
  CreateGoalRequest,
  CreateStageRequest,
  CreateStepRequest,
  GoalDto,
  GoalProgressEntryDto,
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
 *
 * Rows in the trash are invisible to every method here except the trash ones: a goal, stage or
 * step with `deletedAt`, or under a parent that has it, is "not found".
 */
export type GoalsRepository = {
  readTree(userId: string): Promise<GoalTreeResponse>
  upsertLifeGoal(userId: string, title: string): Promise<LifeGoalDto>
  /** `trash` sends the goals to the trash with it; `detach` leaves them in work. */
  deleteLifeGoal(userId: string, mode: 'trash' | 'detach', now: Date): Promise<GoalTreeResponse>
  /** `today` is the person's day, `YYYY-MM-DD`, for the "not in the past" rule. */
  createGoal(userId: string, input: CreateGoalRequest, today: string): Promise<GoalDto>
  updateGoal(
    userId: string,
    goalId: string,
    input: UpdateGoalRequest,
    today: string,
  ): Promise<GoalDto>
  recordProgress(userId: string, goalId: string, currentValue: number): Promise<GoalDto>
  readProgressHistory(userId: string, goalId: string): Promise<GoalProgressEntryDto[]>
  closeGoal(
    userId: string,
    goalId: string,
    input: CloseGoalRequest,
    now: Date,
  ): Promise<GoalDto>
  /** `deadline` is `YYYY-MM-DD`. */
  reopenGoal(userId: string, goalId: string, deadline: string, today: string): Promise<GoalDto>
  setPrimaryGoal(userId: string, goalId: string): Promise<GoalDto>
  trashGoal(userId: string, goalId: string, now: Date): Promise<GoalTreeResponse>
  createStage(userId: string, goalId: string, input: CreateStageRequest): Promise<GoalDto>
  updateStage(userId: string, stageId: string, input: UpdateStageRequest): Promise<GoalDto>
  trashStage(userId: string, stageId: string, now: Date): Promise<GoalDto>
  reorderStages(userId: string, goalId: string, stageIds: string[]): Promise<GoalDto>
  createStep(userId: string, stageId: string, input: CreateStepRequest): Promise<GoalDto>
  updateStep(
    userId: string,
    stepId: string,
    input: UpdateStepRequest,
    now: Date,
  ): Promise<GoalDto>
  trashStep(userId: string, stepId: string, now: Date): Promise<GoalDto>
  reorderSteps(userId: string, stageId: string, stepIds: string[]): Promise<GoalDto>
}

export type Clock = {
  now(): Date
}

/** The person's "today" from the settings module, wired in `app.ts`. */
export type TodayReader = (userId: string) => Promise<string>
