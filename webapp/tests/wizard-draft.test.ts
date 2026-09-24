import { expect, test } from 'bun:test'

import { readStages } from '../src/features/onboarding/wizard-draft'

const stage = (title: string, ...steps: string[]) => ({
  key: title,
  title,
  steps: steps.map((step) => ({ key: step, title: step })),
})

test('the first goal needs at least one stage with at least one step', () => {
  expect(readStages([stage('')])).toEqual({ error: 'Добавь хотя бы один этап с шагом' })
  expect(readStages([stage('Подготовка')])).toEqual({
    error: 'В каждом этапе нужен хотя бы один шаг',
  })
  expect(readStages([stage('', 'Купить кроссовки')])).toEqual({ error: 'Назови каждый этап' })
})

test('blank rows are dropped and the rest is trimmed', () => {
  expect(readStages([stage(' Подготовка ', ' Купить кроссовки ', ' '), stage('', '')])).toEqual({
    stages: [{ title: 'Подготовка', steps: [{ title: 'Купить кроссовки' }] }],
  })
})
