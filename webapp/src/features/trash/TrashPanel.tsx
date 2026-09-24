import type { TrashItemDto, TrashKind } from '@dilife/contracts'
import { toast } from 'sonner'

import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { describeApiError } from '@/platform/api'
import { formatDate } from '@/platform/intl'
import { usePurgeFromTrash, useRestoreFromTrash, useTrashQuery } from './queries'

const kindNames: Record<TrashKind, string> = {
  goal: 'Цель',
  stage: 'Этап',
  step: 'Шаг',
  task: 'Задача',
  note: 'Заметка',
  habit: 'Привычка',
}

/**
 * «Настройки → Данные → Корзина»: everything deleted in the last 30 days, with the day it will
 * be gone for good, a way back, and a way to remove it now (task 11).
 */
export function TrashPanel() {
  const trash = useTrashQuery()
  const restore = useRestoreFromTrash()
  const purge = usePurgeFromTrash()

  return (
    <Card data-testid="trash-panel">
      <CardHeader>
        <Typography as="h2" variant="h6">
          Корзина
        </Typography>
        <CardDescription>
          Удалённое хранится здесь 30 дней, потом исчезает насовсем.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {trash.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : trash.isError ? (
          <Typography tone="destructive" variant="bodySm">
            Не удалось загрузить корзину. Обнови страницу.
          </Typography>
        ) : trash.data.items.length === 0 ? (
          <Typography data-testid="trash-empty" tone="muted" variant="bodySm">
            Корзина пуста. Сюда попадают удалённые задачи, цели, этапы, шаги, заметки и привычки.
          </Typography>
        ) : (
          <ul className="flex flex-col divide-y">
            {trash.data.items.map((item) => (
              <TrashRow
                busy={restore.isPending || purge.isPending}
                item={item}
                key={`${item.kind}-${item.id}`}
                onPurge={() =>
                  purge.mutate(
                    { kind: item.kind, id: item.id },
                    {
                      onError: (error) =>
                        toast.error(describeApiError(error, 'Не удалось удалить. Попробуй ещё раз.')),
                    },
                  )
                }
                onRestore={() =>
                  restore.mutate(
                    { kind: item.kind, id: item.id },
                    {
                      onSuccess: ({ restored }) => toast(restoredMessage(restored)),
                      onError: (error) =>
                        toast.error(
                          describeApiError(error, 'Не удалось восстановить. Попробуй ещё раз.'),
                        ),
                    },
                  )
                }
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function TrashRow({
  busy,
  item,
  onPurge,
  onRestore,
}: {
  busy: boolean
  item: TrashItemDto
  onPurge: () => void
  onRestore: () => void
}) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center" data-testid={`trash-${item.kind}-${item.id}`}>
      <div className="flex min-w-0 flex-1 flex-col">
        <Typography variant="bodySmMedium">
          {kindNames[item.kind]}: {item.title}
        </Typography>
        <Typography tone="muted" variant="caption">
          {[
            item.parentTitle ? `цель «${item.parentTitle}»` : null,
            item.day ? `на ${formatDate(item.day)}` : null,
            `удалено ${formatDate(item.deletedAt)}`,
            `исчезнет ${formatDate(item.purgeAt)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
      </div>
      <div className="flex gap-2">
        <Button
          data-testid={`trash-restore-${item.id}`}
          disabled={busy}
          onClick={onRestore}
          size="sm"
          type="button"
          variant="outline"
        >
          Восстановить
        </Button>
        <Button
          data-testid={`trash-purge-${item.id}`}
          disabled={busy}
          onClick={onPurge}
          size="sm"
          type="button"
          variant="ghost"
        >
          Удалить навсегда
        </Button>
      </div>
    </li>
  )
}

function restoredMessage(restored: TrashItemDto[]) {
  if (restored.length <= 1) return 'Восстановлено'
  const extra = restored.slice(0, -1).map((item) => `${kindNames[item.kind].toLowerCase()} «${item.title}»`)
  return `Восстановлено вместе с: ${extra.join(', ')}`
}
