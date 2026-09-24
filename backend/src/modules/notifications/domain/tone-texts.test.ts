import { describe, expect, test } from 'bun:test'
import { notificationToneKeys, tones } from '@dilife/contracts'

import { notificationText, notificationTexts } from './tone-texts'

const params = { goal: 'Марафон', firstTask: 'Пробежка', tasks: 3, days: 3, done: 2, total: 5 }

describe('notification texts', () => {
  test('every tone has a title and a body for every notification', () => {
    for (const tone of tones) {
      for (const key of notificationToneKeys) {
        const text = notificationTexts[tone][key](params)
        expect(text.title.trim().length).toBeGreaterThan(0)
        expect(text.body.trim().length).toBeGreaterThan(0)
      }
    }
  })

  test('the four tones say each notification differently', () => {
    for (const key of notificationToneKeys) {
      const bodies = new Set(tones.map((tone) => notificationText(tone, key, params).body))
      expect(bodies.size).toBe(tones.length)
    }
  })

  test('no notification addresses the person formally', () => {
    const formal = /(^|[^а-яё])(вы|вас|вам|ваш[а-яё]*|вами)([^а-яё]|$)/i
    for (const tone of tones) {
      for (const key of notificationToneKeys) {
        const text = notificationText(tone, key, params)
        expect(`${text.title} ${text.body}`).not.toMatch(formal)
      }
    }
  })

  test('an unknown tone reads as friendly', () => {
    expect(notificationText('loud', 'morningGreetingEmpty')).toEqual(
      notificationTexts.friendly.morningGreetingEmpty({}),
    )
  })
})
