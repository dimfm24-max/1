import type {
  ApplyTemplateRequest,
  CreateCategoryRequest,
  CreateSubtaskRequest,
  CreateTaskRequest,
  CreateTemplateItemRequest,
  CreateTemplateRequest,
  RepeatScope,
  RepeatTaskRequest,
  ResolveTaskRequest,
  SaveDayAsTemplateRequest,
  UpdateCategoryRequest,
  UpdateSettingsRequest,
  UpdateSubtaskRequest,
  UpdateTaskRequest,
  UpdateTemplateItemRequest,
  UpdateTemplateRequest,
} from '@dilife/contracts'

import type { AuthenticatedPrincipal } from '../../auth'
import type { SettingsReader } from '../../settings'
import type { Clock, DayRepository } from './ports'

type DayServiceDependencies = {
  clock: Clock
  repository: DayRepository
  settings: SettingsReader
}

/** How far ahead opening a day fills in its repeats and scheduled templates. */
const openingHorizonDays = 14

function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000,
  )
}

/**
 * Coordination only. What lives here is the clock and the lookups a write needs from the
 * settings: the person's today, their day start and their default task length.
 */
export class DayService {
  constructor(private readonly dependencies: DayServiceDependencies) {}

  async readDay(principal: AuthenticatedPrincipal, date: string) {
    const [settings, today] = await Promise.all([
      this.dependencies.settings.read(principal.id),
      this.dependencies.settings.today(principal.id),
    ])
    // Repeats and scheduled templates fill today and the days ahead as they are opened; a past
    // day is never filled after the fact (tasks 17, 18, 21).
    const ahead = daysBetween(today, date)
    if (ahead >= 0 && ahead <= openingHorizonDays) {
      await this.dependencies.repository.materializeDay(principal.id, date)
    }
    return this.dependencies.repository.readDay(principal.id, date, settings.dayStartMinute)
  }

  async readContext(principal: AuthenticatedPrincipal) {
    const settings = await this.dependencies.settings.read(principal.id)
    const context = await this.dependencies.repository.readContext(
      principal.id,
      this.dependencies.clock.now(),
    )
    return { settings, ...context }
  }

  async readStepPlans(principal: AuthenticatedPrincipal) {
    const today = await this.dependencies.settings.today(principal.id)
    return { plans: await this.dependencies.repository.readStepPlans(principal.id, today) }
  }

  async appliedTemplates(principal: AuthenticatedPrincipal, date: string) {
    return {
      templateIds: await this.dependencies.repository.appliedTemplateIds(principal.id, date),
    }
  }

  async createTask(principal: AuthenticatedPrincipal, input: CreateTaskRequest) {
    const settings = await this.dependencies.settings.read(principal.id)
    return {
      task: await this.dependencies.repository.createTask(
        principal.id,
        input,
        settings.defaultTaskMinutes,
      ),
    }
  }

  async updateTask(
    principal: AuthenticatedPrincipal,
    taskId: string,
    input: UpdateTaskRequest,
  ) {
    return {
      task: await this.dependencies.repository.updateTask(
        principal.id,
        taskId,
        input,
        this.dependencies.clock.now(),
      ),
    }
  }

  async repeatTask(principal: AuthenticatedPrincipal, taskId: string, input: RepeatTaskRequest) {
    const today = await this.dependencies.settings.today(principal.id)
    return {
      task: await this.dependencies.repository.repeatTask(
        principal.id,
        taskId,
        input,
        today,
        this.dependencies.clock.now(),
      ),
    }
  }

  async stopRepeat(principal: AuthenticatedPrincipal, seriesId: string) {
    const today = await this.dependencies.settings.today(principal.id)
    await this.dependencies.repository.stopRepeat(
      principal.id,
      seriesId,
      today,
      this.dependencies.clock.now(),
    )
    return { stopped: true as const }
  }

  async resolveTask(
    principal: AuthenticatedPrincipal,
    taskId: string,
    input: ResolveTaskRequest,
  ) {
    return { task: await this.dependencies.repository.resolveTask(principal.id, taskId, input) }
  }

  async deleteTask(principal: AuthenticatedPrincipal, taskId: string, scope?: RepeatScope) {
    const settings = await this.dependencies.settings.read(principal.id)
    return this.dependencies.repository.deleteTask(
      principal.id,
      taskId,
      this.dependencies.clock.now(),
      scope,
      settings.dayStartMinute,
    )
  }

  async createSubtask(
    principal: AuthenticatedPrincipal,
    taskId: string,
    input: CreateSubtaskRequest,
  ) {
    return { task: await this.dependencies.repository.createSubtask(principal.id, taskId, input) }
  }

  async updateSubtask(
    principal: AuthenticatedPrincipal,
    subtaskId: string,
    input: UpdateSubtaskRequest,
  ) {
    return {
      task: await this.dependencies.repository.updateSubtask(
        principal.id,
        subtaskId,
        input,
        this.dependencies.clock.now(),
      ),
    }
  }

  async deleteSubtask(principal: AuthenticatedPrincipal, subtaskId: string) {
    return { task: await this.dependencies.repository.deleteSubtask(principal.id, subtaskId) }
  }

  /**
   * Kept for one release while open tabs still call `PATCH /api/day/settings`; the settings
   * module owns the write. Remove once every client uses `PATCH /api/settings`.
   */
  async updateSettings(principal: AuthenticatedPrincipal, input: UpdateSettingsRequest) {
    const { settings } = await this.dependencies.settings.update(principal, input)
    return { settings }
  }

  async createCategory(principal: AuthenticatedPrincipal, input: CreateCategoryRequest) {
    return { categories: await this.dependencies.repository.createCategory(principal.id, input) }
  }

  async updateCategory(
    principal: AuthenticatedPrincipal,
    categoryId: string,
    input: UpdateCategoryRequest,
  ) {
    return {
      categories: await this.dependencies.repository.updateCategory(
        principal.id,
        categoryId,
        input,
      ),
    }
  }

  async deleteCategory(principal: AuthenticatedPrincipal, categoryId: string) {
    return {
      categories: await this.dependencies.repository.deleteCategory(principal.id, categoryId),
    }
  }

  async createTemplate(principal: AuthenticatedPrincipal, input: CreateTemplateRequest) {
    return { templates: await this.dependencies.repository.createTemplate(principal.id, input) }
  }

  async updateTemplate(
    principal: AuthenticatedPrincipal,
    templateId: string,
    input: UpdateTemplateRequest,
  ) {
    const today = await this.dependencies.settings.today(principal.id)
    return {
      templates: await this.dependencies.repository.updateTemplate(
        principal.id,
        templateId,
        input,
        today,
      ),
    }
  }

  async deleteTemplate(principal: AuthenticatedPrincipal, templateId: string) {
    return {
      templates: await this.dependencies.repository.deleteTemplate(principal.id, templateId),
    }
  }

  async createTemplateItem(
    principal: AuthenticatedPrincipal,
    templateId: string,
    input: CreateTemplateItemRequest,
  ) {
    const settings = await this.dependencies.settings.read(principal.id)
    return {
      templates: await this.dependencies.repository.createTemplateItem(
        principal.id,
        templateId,
        input,
        settings.defaultTaskMinutes,
      ),
    }
  }

  async updateTemplateItem(
    principal: AuthenticatedPrincipal,
    itemId: string,
    input: UpdateTemplateItemRequest,
  ) {
    return {
      templates: await this.dependencies.repository.updateTemplateItem(principal.id, itemId, input),
    }
  }

  async deleteTemplateItem(principal: AuthenticatedPrincipal, itemId: string) {
    return {
      templates: await this.dependencies.repository.deleteTemplateItem(principal.id, itemId),
    }
  }

  async applyTemplate(principal: AuthenticatedPrincipal, input: ApplyTemplateRequest) {
    const settings = await this.dependencies.settings.read(principal.id)
    return this.dependencies.repository.applyTemplate(
      principal.id,
      input,
      settings.dayStartMinute,
    )
  }

  async saveDayAsTemplate(principal: AuthenticatedPrincipal, input: SaveDayAsTemplateRequest) {
    return {
      templates: await this.dependencies.repository.saveDayAsTemplate(principal.id, input),
    }
  }
}
