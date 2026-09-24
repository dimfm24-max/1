/** The three Russian forms of a counted noun: for 1, for 2–4, for 5 and more. */
export type PluralForms = readonly [one: string, few: string, many: string]

/** Picks the form that agrees with `count`: 1 день, 2 дня, 5 дней, 11 дней, 21 день. */
export function pluralForm(count: number, forms: PluralForms): string {
  const tail = Math.abs(Math.trunc(count)) % 100
  if (tail >= 11 && tail <= 14) return forms[2]
  const last = tail % 10
  if (last === 1) return forms[0]
  if (last >= 2 && last <= 4) return forms[1]
  return forms[2]
}

/** `5 дней`: the number and the form that agrees with it. */
export function formatCount(count: number, forms: PluralForms): string {
  return `${formatNumber(count)} ${pluralForm(count, forms)}`
}

const numberFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 })

/** `3,333` and `12 500`: a decimal comma and grouped thousands, as Russian readers expect. */
export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}
