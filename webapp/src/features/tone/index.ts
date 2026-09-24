import type { InterfaceToneKey } from '@dilife/contracts'

import { useSettingsQuery } from '@/features/settings'
import { toneText, type ToneParams } from './catalog'

export { toneCatalog, toneNames, toneText, type ToneParams } from './catalog'
export { TonePicker, ToneSettingsPanel } from './ToneSettingsPanel'

/**
 * `say(key, params)` in the person's current tone. Reads the tone from the settings query, so a
 * tone changed in the settings speaks on every screen without a reload.
 */
export function useToneText() {
  const tone = useSettingsQuery().data?.settings.tone
  return (key: InterfaceToneKey, params?: ToneParams) => toneText(tone, key, params)
}
