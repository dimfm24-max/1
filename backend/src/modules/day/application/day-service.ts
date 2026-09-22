import type {
  ApplyTemplateRequest,
  CreateCategoryRequest,
  CreateSubtaskRequest,
  CreateTaskRequest,
  CreateTemplateItemRequest,
  CreateTemplateRequest,
  ResolveTaskRequest,
  UpdateCategoryRequest,
  UpdateSettingsRequest,
  UpdateSubtaskRequest,
  UpdateTaskRequest,
} from '@dilife/contracts'

import type { AuthenticatedPrincipal } from '../../auth'
import type { Clock, DayRepository } from './ports'

type DayServiceDependencies = {
  clock: Clock
  repository: DayRepository
}

/**
 * Coordination only. What lives here is the clock and the one lookup a write needs before it can
 * run: a task with no duration takes the person's default, which is a setting, not a constant.
 */
export class DayService {
  constructor(private readonly dependencies: DayServiceDependencies) {}

  readDay(principal: AuthenticatedPrincipal, date: string) {
    return this.dependencies.repository.readDay(principal.id, date)
  }

  readContext(principal: AuthenticatedPrincipal) {
    return this.dependencies.repository.readContext(principal.id)
  }

  async createTask(principal: AuthenticatedPrincipal, input: CreateTaskRequest) {
    const settings = await this.dependencies.repository.settingsFor(principal.id)
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

  async resolveTask(
    principal: AuthenticatedPrincipal,
    taskId: string,
    input: ResolveTaskRequest,
  ) {
    return { task: await this.dependencies.repository.resolveTask(principal.id, taskId, input) }
  }

  deleteTask(principal: AuthenticatedPrincipal, taskId: string) {
    return this.dependencies.repository.deleteTask(principal.id, taskId)
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

  async updateSettings(principal: AuthenticatedPrincipal, input: UpdateSettingsRequest) {
    return { settings: await this.dependencies.repository.updateSettings(principal.id, input) }
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
    const settings = await this.dependencies.repository.settingsFor(principal.id)
    return {
      templates: await this.dependencies.repository.createTemplateItem(
        principal.id,
        templateId,
        input,
        settings.defaultTaskMinutes,
      ),
    }
  }

  async deleteTemplateItem(principal: AuthenticatedPrincipal, itemId: string) {
    return {
      templates: await this.dependencies.repository.deleteTemplateItem(principal.id, itemId),
    }
  }

  applyTemplate(principal: AuthenticatedPrincipal, input: ApplyTemplateRequest) {
    return this.dependencies.repository.applyTemplate(principal.id, input)
  }
}
