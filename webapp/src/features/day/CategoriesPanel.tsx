import type { TaskCategoryDto } from '@dilife/contracts'
import { useState } from 'react'
import { toast } from 'sonner'

import { ColorPicker } from '@/components/ColorPicker'
import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { describeApiError } from '@/platform/api'
import {
  useCreateCategoryMutation,
  useDayContextQuery,
  useDeleteCategoryMutation,
  useUpdateCategoryMutation,
} from './queries'

const firstColor = '#3b82f6'

/**
 * «Настройки → Категории» (task 14): the person's categories with their colours. A new colour
 * shows at once on every task of the category that has no colour of its own.
 */
export function CategoriesPanel() {
  const context = useDayContextQuery()
  const create = useCreateCategoryMutation()
  const [title, setTitle] = useState('')
  const [color, setColor] = useState<string>(firstColor)
  const [deleting, setDeleting] = useState<TaskCategoryDto | null>(null)

  if (!context.data) {
    return (
      <Typography tone="muted" variant="bodySm">
        {context.isError ? 'Не удалось загрузить категории. Обнови страницу.' : 'Загружаем…'}
      </Typography>
    )
  }

  const categories = context.data.categories
  const add = () =>
    create.mutate(
      { title: title.trim(), color },
      {
        onSuccess: () => {
          setTitle('')
          toast(`Категория «${title.trim()}» добавлена`)
        },
      },
    )

  return (
    <Card data-testid="category-settings">
      <CardHeader>
        <Typography as="h2" variant="h6">
          Категории
        </Typography>
        <CardDescription>
          Цвет категории красит её задачи на шкале дня. Свой цвет задачи важнее.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {categories.length === 0 ? (
          <Typography tone="muted" variant="bodySm">
            Категорий пока нет. Добавь первую ниже.
          </Typography>
        ) : (
          <ul className="flex flex-col gap-3">
            {categories.map((category) => (
              <CategoryRow category={category} key={category.id} onDelete={() => setDeleting(category)} />
            ))}
          </ul>
        )}

        <form
          className="flex flex-col gap-3 rounded-lg border p-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (title.trim() !== '') add()
          }}
        >
          <Typography variant="bodySmMedium">Новая категория</Typography>
          <Input
            aria-label="Название категории"
            data-testid="category-new-title"
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например: учёба"
            value={title}
          />
          <ColorPicker label="Цвет новой категории" onChange={(next) => setColor(next ?? firstColor)} value={color} />
          {create.isError ? (
            <Typography tone="destructive" variant="caption">
              {describeApiError(create.error, 'Категория не добавилась. Попробуй ещё раз.')}
            </Typography>
          ) : null}
          <div>
            <Button data-testid="category-new-submit" disabled={title.trim() === '' || create.isPending} type="submit">
              Добавить
            </Button>
          </div>
        </form>
      </CardContent>

      <DeleteCategoryDialog category={deleting} onClose={() => setDeleting(null)} />
    </Card>
  )
}

function CategoryRow({ category, onDelete }: { category: TaskCategoryDto; onDelete: () => void }) {
  const update = useUpdateCategoryMutation()
  const [title, setTitle] = useState(category.title)
  const [shownTitle, setShownTitle] = useState(category.title)
  if (shownTitle !== category.title) {
    setShownTitle(category.title)
    setTitle(category.title)
  }

  const rename = () => {
    const next = title.trim()
    if (next === '' || next === category.title) {
      setTitle(category.title)
      return
    }
    update.mutate({ categoryId: category.id, input: { title: next } })
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3" data-testid={`category-${category.id}`}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
        <Input
          aria-label={`Название категории «${category.title}»`}
          data-testid={`category-title-${category.id}`}
          maxLength={200}
          onBlur={rename}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          value={title}
        />
        <Button
          data-testid={`category-delete-${category.id}`}
          onClick={onDelete}
          size="sm"
          type="button"
          variant="ghost"
        >
          Удалить
        </Button>
      </div>
      <ColorPicker
        disabled={update.isPending}
        label={`Цвет категории «${category.title}»`}
        onChange={(color) => color && update.mutate({ categoryId: category.id, input: { color } })}
        value={category.color}
      />
      {update.isError ? (
        <Typography tone="destructive" variant="caption">
          {describeApiError(update.error, 'Не сохранилось. Попробуй ещё раз.')}
        </Typography>
      ) : null}
    </li>
  )
}

function DeleteCategoryDialog({ category, onClose }: { category: TaskCategoryDto | null; onClose: () => void }) {
  const remove = useDeleteCategoryMutation()
  const usage = category?.usage
  const used = usage ? usage.tasks + usage.templateItems : 0

  return (
    <Dialog onOpenChange={(open) => (open ? undefined : onClose())} open={category !== null}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Удалить «{category?.title}»?</DialogTitle>
          <DialogDescription>
            {used > 0 && usage
              ? `Задач с этой категорией: ${usage.tasks}, пунктов шаблонов: ${usage.templateItems}. Они останутся, но без категории и её цвета.`
              : 'Категорией ничего не пользуется.'}
          </DialogDescription>
        </DialogHeader>
        {remove.isError ? (
          <Typography tone="destructive" variant="caption">
            {describeApiError(remove.error, 'Не удалилось. Попробуй ещё раз.')}
          </Typography>
        ) : null}
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="ghost">
            Отмена
          </Button>
          <Button
            data-testid="category-delete-confirm"
            disabled={remove.isPending}
            onClick={() =>
              category &&
              remove.mutate(category.id, {
                onSuccess: () => {
                  onClose()
                  toast(`Категория «${category.title}» удалена`)
                },
              })
            }
            type="button"
            variant="destructive"
          >
            Удалить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
