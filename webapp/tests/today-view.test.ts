import { expect, test } from 'bun:test'

import { greetingFor, todayHeadline } from '../src/features/today/today-view'

test("the greeting follows the hour on the viewer's clock", () => {
  expect(greetingFor(4)).toBe('Доброй ночи')
  expect(greetingFor(5)).toBe('Доброе утро')
  expect(greetingFor(12)).toBe('Добрый день')
  expect(greetingFor(17)).toBe('Добрый вечер')
  expect(greetingFor(23)).toBe('Доброй ночи')
})

test('the headline names the person when they gave a name', () => {
  // 08:00 on the person's own clock.
  const morning = 8 * 60
  expect(todayHeadline(morning, 'Дима')).toBe('Доброе утро, Дима!')
  expect(todayHeadline(morning, '   ')).toBe('Доброе утро!')
  expect(todayHeadline(morning, null)).toBe('Доброе утро!')
})

