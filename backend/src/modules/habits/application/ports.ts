import type {
  CreateHabitRequest,
  HabitDto,
  MarkHabitRequest,
  UpdateHabitRequest,
} from '@dilife/contracts'

export type HabitsRepository = {
  list(userId: string, today: string): Promise<HabitDto[]>
  create(userId: string, input: CreateHabitRequest, today: string): Promise<HabitDto>
  update(
    userId: string,
    habitId: string,
    input: UpdateHabitRequest,
    today: string,
    now: Date,
  ): Promise<HabitDto>
  mark(
    userId: string,
    habitId: string,
    input: MarkHabitRequest,
    today: string,
  ): Promise<HabitDto>
  remove(userId: string, habitId: string, today: string): Promise<HabitDto[]>
}

export type Clock = {
  now(): Date
}
