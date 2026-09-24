import { Add01Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { emptyStage, type StageDraft } from './wizard-draft'

/** Stages of the first goal and the steps inside each, typed in place (task 07). */
export function StagesEditor({
  onChange,
  stages,
}: {
  onChange: (stages: StageDraft[]) => void
  stages: StageDraft[]
}) {
  const setStage = (key: string, next: StageDraft) =>
    onChange(stages.map((stage) => (stage.key === key ? next : stage)))

  return (
    <div className="flex flex-col gap-4" data-testid="wizard-stages">
      {stages.map((stage, stageIndex) => (
        <div className="flex flex-col gap-2 rounded-lg border p-3" key={stage.key}>
          <div className="flex items-center gap-2">
            <Input
              aria-label={`Этап ${stageIndex + 1}`}
              data-testid={`wizard-stage-${stageIndex}`}
              maxLength={200}
              onChange={(event) => setStage(stage.key, { ...stage, title: event.target.value })}
              placeholder={stageIndex === 0 ? 'Этап, например: подготовка' : 'Этап'}
              value={stage.title}
            />
            {stages.length > 1 ? (
              <Button
                aria-label={`Убрать этап ${stageIndex + 1}`}
                onClick={() => onChange(stages.filter((other) => other.key !== stage.key))}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <HugeiconsIcon aria-hidden icon={Delete02Icon} strokeWidth={2} />
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 pl-4">
            {stage.steps.map((step, stepIndex) => (
              <div className="flex items-center gap-2" key={step.key}>
                <Input
                  aria-label={`Шаг ${stepIndex + 1} этапа ${stageIndex + 1}`}
                  data-testid={`wizard-step-${stageIndex}-${stepIndex}`}
                  maxLength={200}
                  onChange={(event) =>
                    setStage(stage.key, {
                      ...stage,
                      steps: stage.steps.map((other) =>
                        other.key === step.key ? { ...other, title: event.target.value } : other,
                      ),
                    })
                  }
                  placeholder={stepIndex === 0 ? 'Шаг, например: купить кроссовки' : 'Шаг'}
                  value={step.title}
                />
                {stage.steps.length > 1 ? (
                  <Button
                    aria-label={`Убрать шаг ${stepIndex + 1}`}
                    onClick={() =>
                      setStage(stage.key, {
                        ...stage,
                        steps: stage.steps.filter((other) => other.key !== step.key),
                      })
                    }
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <HugeiconsIcon aria-hidden icon={Delete02Icon} strokeWidth={2} />
                  </Button>
                ) : null}
              </div>
            ))}
            <Button
              className="self-start"
              data-testid={`wizard-add-step-${stageIndex}`}
              onClick={() =>
                setStage(stage.key, {
                  ...stage,
                  steps: [...stage.steps, { key: crypto.randomUUID(), title: '' }],
                })
              }
              size="sm"
              type="button"
              variant="ghost"
            >
              <HugeiconsIcon aria-hidden icon={Add01Icon} strokeWidth={2} />
              Шаг
            </Button>
          </div>
        </div>
      ))}
      <Button
        className="self-start"
        data-testid="wizard-add-stage"
        onClick={() => onChange([...stages, emptyStage()])}
        size="sm"
        type="button"
        variant="outline"
      >
        <HugeiconsIcon aria-hidden icon={Add01Icon} strokeWidth={2} />
        Этап
      </Button>
      <Typography tone="muted" variant="caption">
        Нужен хотя бы один этап и один шаг. Остальное можно добавить потом в «Целях».
      </Typography>
    </div>
  )
}
