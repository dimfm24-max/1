import { expect, test } from 'bun:test'
import { interfaceToneKeys, tones } from '@dilife/contracts'

import { toneCatalog, toneText } from '../src/features/tone/catalog'

const params = { goal: 'Марафон', days: 3, done: 2, total: 5 }

test('every tone has a line for every place the interface speaks', () => {
  for (const tone of tones) {
    for (const key of interfaceToneKeys) {
      expect(toneCatalog[tone][key](params).trim().length).toBeGreaterThan(0)
    }
  }
})

test('the four tones say each place differently', () => {
  for (const key of interfaceToneKeys) {
    const lines = new Set(tones.map((tone) => toneText(tone, key, params)))
    expect(lines.size).toBe(tones.length)
  }
})

test('no tone addresses the person formally', () => {
  const formal = /(^|[^а-яё])(вы|вас|вам|ваш[а-яё]*|вами)([^а-яё]|$)/i
  for (const tone of tones) {
    for (const key of interfaceToneKeys) {
      expect(toneText(tone, key, params)).not.toMatch(formal)
    }
  }
})

test('the text follows the tone it is asked for, and an unknown tone reads as friendly', () => {
  expect(toneText('neutral', 'todayLine')).toBe(toneCatalog.neutral.todayLine({}))
  expect(toneText(undefined, 'todayLine')).toBe(toneCatalog.friendly.todayLine({}))
})
