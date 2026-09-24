import type { TrashKind } from '@dilife/contracts'
import { toast } from 'sonner'

import { useRestoreFromTrash } from './queries'

/**
 * The message after a delete: what went to the trash and «Отменить», which brings it back at
 * once (task 11). Every screen that deletes uses this one, so the wording and the undo agree.
 */
export function useTrashedNotice() {
  const restore = useRestoreFromTrash()
  return (kind: TrashKind, id: string, label: string) =>
    toast(`${label} — в корзине`, {
      description: 'Восстановить можно 30 дней: «Настройки → Данные».',
      action: {
        label: 'Отменить',
        onClick: () =>
          restore.mutate(
            { kind, id },
            { onError: () => toast.error('Не получилось вернуть. Попробуй из корзины.') },
          ),
      },
    })
}
