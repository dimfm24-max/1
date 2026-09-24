import { emptyGoalDraft, type GoalDraft } from '@/features/goals'

/** A stage of the first goal as typed in the wizard, with its steps. */
export type StageDraft = { key: string; title: string; steps: Array<{ key: string; title: string }> }

/**
 * What the wizard keeps in this browser between reloads: the step it is on and the first goal,
 * which only reaches the server with «Готово». Tone, horizon and the life goal are saved as each
 * step is left, so they come back from the server (task 07).
 */
export type WizardDraft = {
  step: number
  goal: GoalDraft
  stages: StageDraft[]
  /** One key for the whole wizard, so a retried «Готово» makes one goal, not two. */
  creationKey: string
}

export const wizardSteps = 4

function newKey() {
  return crypto.randomUUID()
}

export function emptyStage(): StageDraft {
  return { key: newKey(), title: '', steps: [{ key: newKey(), title: '' }] }
}

export function emptyWizardDraft(): WizardDraft {
  return { step: 0, goal: emptyGoalDraft(), stages: [emptyStage()], creationKey: newKey() }
}

function storageKey(userId: string) {
  return `dilife_wizard_${userId}`
}

export function readWizardDraft(userId: string): WizardDraft {
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return emptyWizardDraft()
    const parsed = JSON.parse(raw) as Partial<WizardDraft>
    const base = emptyWizardDraft()
    return {
      step: typeof parsed.step === 'number' ? Math.min(Math.max(parsed.step, 0), wizardSteps - 1) : 0,
      goal: { ...base.goal, ...(parsed.goal ?? {}) },
      stages: Array.isArray(parsed.stages) && parsed.stages.length > 0 ? parsed.stages : base.stages,
      creationKey: typeof parsed.creationKey === 'string' ? parsed.creationKey : base.creationKey,
    }
  } catch {
    return emptyWizardDraft()
  }
}

export function writeWizardDraft(userId: string, draft: WizardDraft) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(draft))
  } catch {
    // Blocked storage: the wizard still works, only a reload starts the first goal over.
  }
}

export function clearWizardDraft(userId: string) {
  try {
    window.localStorage.removeItem(storageKey(userId))
  } catch {
    // Nothing to clean where nothing could be stored.
  }
}

/** The stages ready to send, or what is missing: at least one stage with at least one step. */
export function readStages(stages: StageDraft[]):
  | { stages: Array<{ title: string; steps: Array<{ title: string }> }> }
  | { error: string } {
  const cleaned = stages
    .map((stage) => ({
      title: stage.title.trim(),
      steps: stage.steps.map((step) => ({ title: step.title.trim() })).filter((step) => step.title !== ''),
    }))
    .filter((stage) => stage.title !== '' || stage.steps.length > 0)
  if (cleaned.length === 0) return { error: 'Добавь хотя бы один этап с шагом' }
  if (cleaned.some((stage) => stage.title === '')) return { error: 'Назови каждый этап' }
  if (cleaned.some((stage) => stage.steps.length === 0)) {
    return { error: 'В каждом этапе нужен хотя бы один шаг' }
  }
  if (cleaned.some((stage) => stage.title.length > 200 || stage.steps.some((step) => step.title.length > 200))) {
    return { error: 'Названия — не длиннее 200 знаков' }
  }
  return { stages: cleaned }
}
