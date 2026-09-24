import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DragDropVerticalIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

/**
 * A vertical list whose rows are reordered by dragging a handle, or with the keyboard: focus the
 * handle, Space to lift, arrows to move, Space to drop. The new order shows at once; `onReorder`
 * saves it, and until the saved order comes back the list keeps showing the one just made.
 */
export function SortableList<Item extends { id: string }>({
  disabled = false,
  handleLabel,
  items,
  onReorder,
  renderItem,
}: {
  disabled?: boolean
  /** What the drag handle of a row says to a screen reader, e.g. «Перетащить этап „Подготовка“». */
  handleLabel: (item: Item) => string
  items: ReadonlyArray<Item>
  onReorder: (ids: string[]) => void
  renderItem: (item: Item, handle: ReactNode) => ReactNode
}) {
  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a tap on the handle stays a tap.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [pending, setPending] = useState<{ basis: string; ids: string[] } | null>(null)
  const basis = items.map((item) => item.id).join(',')
  // The server's order wins once it changes; until then the order just made is shown.
  const order = pending && pending.basis === basis ? pending.ids : items.map((item) => item.id)
  const byId = new Map(items.map((item) => [item.id, item]))
  const ordered = order.map((id) => byId.get(id)).filter((item): item is Item => item !== undefined)

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = order.indexOf(String(active.id))
    const to = order.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    const next = arrayMove(order, from, to)
    setPending({ basis, ids: next })
    onReorder(next)
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd} sensors={sensors}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        {ordered.map((item) => (
          <SortableRow
            disabled={disabled}
            handleLabel={handleLabel(item)}
            id={item.id}
            key={item.id}
            render={(handle) => renderItem(item, handle)}
          />
        ))}
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({
  disabled,
  handleLabel,
  id,
  render,
}: {
  disabled: boolean
  handleLabel: string
  id: string
  render: (handle: ReactNode) => ReactNode
}) {
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef, transform, transition } =
    useSortable({ id, disabled })
  const handle = disabled ? null : (
    <Button
      aria-label={handleLabel}
      className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
      ref={setActivatorNodeRef}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...attributes}
      {...listeners}
    >
      <HugeiconsIcon aria-hidden icon={DragDropVerticalIcon} strokeWidth={2} />
    </Button>
  )

  return (
    <div
      className={isDragging ? 'relative z-10 opacity-80' : undefined}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {render(handle)}
    </div>
  )
}
