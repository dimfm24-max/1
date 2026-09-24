import type { NotificationToneKey, Tone } from '@dilife/contracts'

/**
 * What notifications say, in each of the four tones (§9, §10 of PRD.md). The interface keeps
 * its own catalog in the web client; notifications are written here because the server sends
 * them when no page is open.
 *
 * Same rules as on screens: always «ты», no gendered past tense, drafts approved by the owner.
 * A notification is seen on a lock screen, so it names a task or a goal and nothing more
 * personal than that.
 */

export type NotificationParams = {
  goal?: string
  firstTask?: string
  tasks?: number
  days?: number
  done?: number
  total?: number
}

export type NotificationText = { title: string; body: string }

type Text = (params: NotificationParams) => NotificationText
type ToneTexts = Record<NotificationToneKey, Text>

function plural(count: number, forms: readonly [string, string, string]) {
  const tail = Math.abs(count) % 100
  if (tail >= 11 && tail <= 14) return `${count} ${forms[2]}`
  const last = tail % 10
  if (last === 1) return `${count} ${forms[0]}`
  if (last >= 2 && last <= 4) return `${count} ${forms[1]}`
  return `${count} ${forms[2]}`
}

const tasks = (count = 0) => plural(count, ['задача', 'задачи', 'задач'])
const days = (count = 0) => plural(count, ['день', 'дня', 'дней'])

const friendly: ToneTexts = {
  morningGreeting: ({ tasks: count, firstTask }) => ({
    title: 'Доброе утро!',
    body: `Сегодня ${tasks(count)}. Первая — «${firstTask}».`,
  }),
  morningGreetingEmpty: () => ({
    title: 'Доброе утро!',
    body: 'План на сегодня пуст. Поставь в него шаг к цели.',
  }),
  eveningSummary: ({ done = 0, total = 0 }) => ({
    title: 'Итог дня',
    body:
      done >= total
        ? 'Всё сделано — отличный день!'
        : `Сделано ${done} из ${total}. Реши, что сделать с остальным.`,
  }),
  deadlineSoon: ({ goal, days: count }) => ({
    title: 'Срок цели приближается',
    body: `До срока «${goal}» — ${days(count)}. У тебя всё получится!`,
  }),
  deadlineLastDay: ({ goal }) => ({
    title: 'Последний день цели',
    body: `Сегодня последний день цели «${goal}». У тебя всё получится!`,
  }),
}

const pushing: ToneTexts = {
  morningGreeting: ({ tasks: count, firstTask }) => ({
    title: 'Подъём!',
    body: `${tasks(count)} на сегодня. Начни с «${firstTask}».`,
  }),
  morningGreetingEmpty: () => ({
    title: 'Подъём!',
    body: 'План пуст. Цель сама не приблизится — поставь в день хотя бы один шаг.',
  }),
  eveningSummary: ({ done = 0, total = 0 }) => ({
    title: 'Итог дня',
    body:
      done >= total
        ? 'Всё закрыто. Завтра — не хуже.'
        : `Сделано ${done} из ${total}. Разбери хвосты сейчас.`,
  }),
  deadlineSoon: ({ goal, days: count }) => ({
    title: 'Срок близко',
    body: `До срока «${goal}» — ${days(count)}. Самое время ускориться.`,
  }),
  deadlineLastDay: ({ goal }) => ({
    title: 'Последний день',
    body: `Последний день для «${goal}». Выложись по полной.`,
  }),
}

const respectful: ToneTexts = {
  morningGreeting: ({ tasks: count, firstTask }) => ({
    title: 'Доброе утро',
    body: `На сегодня запланировано: ${tasks(count)}. Первая — «${firstTask}».`,
  }),
  morningGreetingEmpty: () => ({
    title: 'Доброе утро',
    body: 'На сегодня ничего не запланировано. Добавь задачу, когда захочешь.',
  }),
  eveningSummary: ({ done = 0, total = 0 }) => ({
    title: 'Итог дня',
    body:
      done >= total
        ? 'Всё запланированное выполнено. Хорошая работа.'
        : `Выполнено ${done} из ${total}. Реши, как поступить с остальными задачами.`,
  }),
  deadlineSoon: ({ goal, days: count }) => ({
    title: 'Приближается срок цели',
    body: `До срока цели «${goal}» — ${days(count)}. Проверь, всё ли идёт по плану.`,
  }),
  deadlineLastDay: ({ goal }) => ({
    title: 'Срок цели сегодня',
    body: `Сегодня срок цели «${goal}». Реши, как её завершить.`,
  }),
}

const neutral: ToneTexts = {
  morningGreeting: ({ tasks: count, firstTask }) => ({
    title: 'План на сегодня',
    body: `${tasks(count)}. Первая — «${firstTask}».`,
  }),
  morningGreetingEmpty: () => ({
    title: 'План на сегодня',
    body: 'Задач на сегодня нет.',
  }),
  eveningSummary: ({ done = 0, total = 0 }) => ({
    title: 'Итог дня',
    body: done >= total ? 'Все задачи выполнены.' : `Выполнено ${done} из ${total}.`,
  }),
  deadlineSoon: ({ goal, days: count }) => ({
    title: 'Срок цели',
    body: `Срок цели «${goal}» — через ${days(count)}.`,
  }),
  deadlineLastDay: ({ goal }) => ({
    title: 'Срок цели',
    body: `Срок цели «${goal}» — сегодня.`,
  }),
}

export const notificationTexts: Record<Tone, ToneTexts> = { friendly, pushing, respectful, neutral }

/** The notification for `key` in `tone`; an unknown tone reads as friendly. */
export function notificationText(
  tone: string,
  key: NotificationToneKey,
  params: NotificationParams = {},
): NotificationText {
  const texts = notificationTexts[tone as Tone] ?? notificationTexts.friendly
  return texts[key](params)
}
