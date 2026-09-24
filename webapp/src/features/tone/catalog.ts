import type { InterfaceToneKey, Tone } from '@dilife/contracts'

import { formatCount } from '@/platform/intl'

/**
 * Every sentence the interface says to a person in their chosen tone (§9 of PRD.md), in one
 * place so a new tone or a reworded line touches this file only.
 *
 * Rules for the texts:
 * - always «ты», in every tone, «уважительный» included;
 * - no gendered past tense («ты сделал»): the app does not know the person's gender;
 * - the drafts are the developer's; the owner approves the list as a whole (task 03).
 */

export type ToneParams = {
  /** A goal title, shown in «кавычках». */
  goal?: string
  /** Days left to a deadline, or days away from the app. */
  days?: number
  done?: number
  total?: number
}

type Line = (params: ToneParams) => string
type ToneLines = Record<InterfaceToneKey, Line>

const days = (count = 0) => formatCount(count, ['день', 'дня', 'дней'])

const friendly: ToneLines = {
  todayLine: () => 'Шаг за шагом — и цель станет ближе.',
  dayEmpty: () => 'На этот день пока пусто. Добавь первую задачу или поставь шаг к цели.',
  daySummaryAllDone: () => 'Всё сделано — отличный день!',
  daySummaryLeft: ({ done = 0, total = 0 }) =>
    `Сделано ${done} из ${total}. Реши, что сделать с остальным.`,
  missedDays: ({ days: count }) =>
    `Тебя не было ${days(count)}. Ничего страшного — давай разберём, что накопилось.`,
  deadlineSoon: ({ goal, days: count }) =>
    `До срока цели «${goal}» — ${days(count)}. У тебя всё получится!`,
  deadlineLastDay: ({ goal }) => `Сегодня последний день цели «${goal}». У тебя всё получится!`,
  deadlineOverdue: ({ goal }) =>
    `Срок цели «${goal}» прошёл. Ничего страшного — реши, что с ней дальше.`,
  horizon: () => 'Впереди ещё много времени — вопрос лишь в том, на что оно уйдёт.',
  horizonPast: () =>
    'Указанный срок уже позади. Измени ожидаемую продолжительность, если хочешь другую точку отсчёта.',
  goalCompleted: ({ goal }) => `Цель «${goal}» достигнута. Поздравляю!`,
  goalAbandoned: () => 'Отказаться — тоже решение. Итог сохранится в архиве.',
}

const pushing: ToneLines = {
  todayLine: () => 'Не сбавляй темп: каждый шаг сегодня двигает цель.',
  dayEmpty: () => 'День пуст, а цель сама не приблизится. Поставь в план хотя бы один шаг.',
  daySummaryAllDone: () => 'Всё закрыто. Завтра — не хуже.',
  daySummaryLeft: ({ done = 0, total = 0 }) =>
    `Сделано ${done} из ${total}. Разбери хвосты сейчас, не оставляй на потом.`,
  missedDays: ({ days: count }) =>
    `${days(count)} без плана. Разбери накопленное и возвращайся в ритм.`,
  deadlineSoon: ({ goal, days: count }) =>
    `До срока «${goal}» — ${days(count)}. Самое время ускориться.`,
  deadlineLastDay: ({ goal }) => `Последний день для «${goal}». Выложись по полной.`,
  deadlineOverdue: ({ goal }) =>
    `Срок цели «${goal}» прошёл. Продли, закрой или откажись — но не оставляй её висеть.`,
  horizon: () => 'Время уходит. Каждый незакрашенный квадрат ещё можно прожить осознанно.',
  horizonPast: () =>
    'Указанный срок уже позади. Сдвинь ожидаемую продолжительность и смотри вперёд.',
  goalCompleted: ({ goal }) => `Цель «${goal}» взята. Следующая ждёт.`,
  goalAbandoned: () => 'Цель закрыта. Сделай вывод — и вперёд, к следующей.',
}

const respectful: ToneLines = {
  todayLine: () => 'Пусть этот день приблизит тебя к цели.',
  dayEmpty: () => 'На этот день ничего не запланировано. Добавь задачу, когда захочешь.',
  daySummaryAllDone: () => 'Всё запланированное выполнено. Хорошая работа.',
  daySummaryLeft: ({ done = 0, total = 0 }) =>
    `Выполнено ${done} из ${total}. Реши, как поступить с остальными задачами.`,
  missedDays: ({ days: count }) =>
    `С прошлого визита прошло ${days(count)}. Посмотри, что накопилось, и реши, как с этим быть.`,
  deadlineSoon: ({ goal, days: count }) =>
    `До срока цели «${goal}» — ${days(count)}. Проверь, всё ли идёт по плану.`,
  deadlineLastDay: ({ goal }) => `Сегодня срок цели «${goal}». Реши, как её завершить.`,
  deadlineOverdue: ({ goal }) =>
    `Срок цели «${goal}» наступил. Выбери: продлить её, завершить или отказаться.`,
  horizon: () => 'Перед тобой — время, которым ты можешь распорядиться.',
  horizonPast: () =>
    'Указанный срок уже позади. Можешь изменить ожидаемую продолжительность, чтобы выбрать другую точку отсчёта.',
  goalCompleted: ({ goal }) => `Цель «${goal}» завершена. Это заслуженный результат.`,
  goalAbandoned: () => 'Решение принято. Итог сохранён в архиве.',
}

const neutral: ToneLines = {
  todayLine: () => 'План на сегодня и продвижение главной цели.',
  dayEmpty: () => 'Задач на этот день нет.',
  daySummaryAllDone: () => 'Все задачи выполнены.',
  daySummaryLeft: ({ done = 0, total = 0 }) =>
    `Выполнено ${done} из ${total}. Остальные задачи ждут решения.`,
  missedDays: ({ days: count }) => `Пропущено: ${days(count)}. Ниже — невыполненные задачи.`,
  deadlineSoon: ({ goal, days: count }) => `Срок цели «${goal}» — через ${days(count)}.`,
  deadlineLastDay: ({ goal }) => `Срок цели «${goal}» — сегодня.`,
  deadlineOverdue: ({ goal }) => `Срок цели «${goal}» прошёл. Продлить, закрыть или отказаться?`,
  horizon: () => 'Оставшееся время по твоим данным.',
  horizonPast: () => 'Указанный срок уже позади. Ожидаемую продолжительность можно изменить.',
  goalCompleted: ({ goal }) => `Цель «${goal}» завершена.`,
  goalAbandoned: () => 'Цель перенесена в архив.',
}

export const toneCatalog: Record<Tone, ToneLines> = { friendly, pushing, respectful, neutral }

/** The names of the four tones as §9 of PRD.md lists them, for the settings and the wizard. */
export const toneNames: Record<Tone, string> = {
  friendly: 'Дружелюбный',
  pushing: 'Подстёгивающий',
  respectful: 'Уважительный',
  neutral: 'Нейтральный',
}

/** The sentence for `key` in `tone`. An unknown tone from an older server reads as friendly. */
export function toneText(tone: Tone | undefined, key: InterfaceToneKey, params: ToneParams = {}) {
  const lines = (tone && toneCatalog[tone]) || toneCatalog.friendly
  return lines[key](params)
}
