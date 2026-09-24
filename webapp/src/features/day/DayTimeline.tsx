import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { TaskCategoryDto, TaskDto } from '@dilife/contracts'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import { Typography } from '@/components/typography'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { findStep, useGoalTreeQuery } from '@/features/goals'
import { cn } from '@/lib/utils'
import { formatDuration, formatMinuteOfDay } from '@/platform/intl'
import {
  hourMarks,
  layoutBlocks,
  MINUTES_IN_DAY,
  nowOffset,
  snapMinutes,
  stretchedDuration,
  taskColor,
  timelineDropId,
  unscheduledDropId,
  type PlacedBlock,
  type TimelineScale,
} from './timeline'

const gutter = '3.5rem'

/**
 * The day as a timeline (tasks 15 and 45): each timed task a block at its time, as tall as it
 * lasts, from the person's own day start. Tasks at the same time stand side by side and are
 * marked. The full view drags and stretches blocks; the compact view on «Сегодня» only ticks them.
 */
export function DayTimeline({
  categories,
  compact = false,
  dayStartMinute,
  highlightTaskId,
  isToday,
  minuteOfDay,
  onOpenTask,
  onResize,
  onToggle,
  scale,
  tasks,
}: {
  categories: ReadonlyArray<TaskCategoryDto>
  compact?: boolean
  dayStartMinute: number
  highlightTaskId?: string
  isToday: boolean
  minuteOfDay: number
  onOpenTask: (task: TaskDto) => void
  onResize?: (task: TaskDto, durationMinutes: number) => void
  onToggle: (task: TaskDto, done: boolean) => void
  scale: TimelineScale
  tasks: ReadonlyArray<TaskDto>
}) {
  const blocks = layoutBlocks(tasks, dayStartMinute, scale)
  const height = MINUTES_IN_DAY * scale.pxPerMinute
  const nowTop = nowOffset(minuteOfDay, dayStartMinute, scale)
  const scroller = useRef<HTMLDivElement>(null)
  const { setNodeRef, isOver } = useDroppable({ id: timelineDropId, disabled: compact })
  const tree = useGoalTreeQuery()

  // Opens on "now" for today, else on the first task, so the useful part is in view.
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const target = isToday ? nowTop : (blocks[0]?.top ?? 8 * 60 * scale.pxPerMinute)
    element.scrollTop = Math.max(target - element.clientHeight / 3, 0)
    // Only when the day or its first block changes, not on every tick of the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday, blocks[0]?.task.id])

  return (
    <div
      className={cn('overflow-y-auto rounded-xl border', compact ? 'max-h-96' : 'max-h-[70svh]')}
      data-testid={compact ? 'today-timeline' : 'day-timeline'}
      ref={scroller}
    >
      <div
        className={cn('relative', isOver && 'bg-primary/5')}
        ref={setNodeRef}
        style={{ height }}
      >
        {hourMarks(dayStartMinute).map((mark) => (
          <div
            aria-hidden="true"
            className="absolute right-0 left-0 border-t border-border/60"
            key={mark.minute}
            style={{ top: mark.offset * scale.pxPerMinute }}
          >
            <Typography
              className="absolute -top-2.5 left-2 bg-card px-1 tabular-nums"
              tone="muted"
              variant="caption"
            >
              {formatMinuteOfDay(mark.minute)}
            </Typography>
          </div>
        ))}

        {blocks.map((block) => (
          <TimelineBlock
            block={block}
            color={taskColor(block.task, categories)}
            compact={compact}
            goalLabel={goalLabel(tree.data?.goals ?? [], block.task.stepId)}
            isHighlighted={block.task.id === highlightTaskId}
            key={block.task.id}
            onOpen={() => onOpenTask(block.task)}
            onResize={onResize}
            onToggle={(done) => onToggle(block.task, done)}
            scale={scale}
            dayStartMinute={dayStartMinute}
          />
        ))}

        {isToday ? (
          <div
            className="pointer-events-none absolute right-0 left-0 z-20 flex items-center"
            data-testid={compact ? 'today-now' : 'day-now'}
            style={{ top: nowTop }}
          >
            <span className="size-2.5 shrink-0 rotate-45 rounded-[2px] bg-primary" />
            <span className="h-0 flex-1 border-t-2 border-dashed border-primary" />
            <Typography className="bg-card px-1" tone="primary" variant="eyebrow">
              Сейчас {formatMinuteOfDay(minuteOfDay)}
            </Typography>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function goalLabel(goals: Parameters<typeof findStep>[0], stepId: string | null) {
  const context = findStep(goals, stepId)
  return context ? `${context.goal.title} · ${context.step.title}` : stepId ? 'шаг цели' : null
}

function TimelineBlock({
  block,
  color,
  compact,
  dayStartMinute,
  goalLabel: label,
  isHighlighted,
  onOpen,
  onResize,
  onToggle,
  scale,
}: {
  block: PlacedBlock
  color: string | null
  compact: boolean
  dayStartMinute: number
  goalLabel: string | null
  isHighlighted: boolean
  onOpen: () => void
  onResize?: (task: TaskDto, durationMinutes: number) => void
  onToggle: (done: boolean) => void
  scale: TimelineScale
}) {
  const { task } = block
  const isClosed = task.outcome !== 'planned'
  const draggable = !compact && !isClosed
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({
    id: `task:${task.id}`,
    data: { kind: 'task', task },
    disabled: !draggable,
  })
  const [stretchPx, setStretchPx] = useState(0)
  const stretch = useRef<{ startY: number } | null>(null)

  const startStretch = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    stretch.current = { startY: event.clientY }
  }
  const moveStretch = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!stretch.current) return
    setStretchPx(event.clientY - stretch.current.startY)
  }
  const endStretch = () => {
    if (!stretch.current || task.startMinute === null) return
    stretch.current = null
    const minutes = snapMinutes(stretchPx, scale)
    setStretchPx(0)
    if (minutes === 0) return
    onResize?.(
      task,
      stretchedDuration(task.startMinute, task.durationMinutes, minutes, dayStartMinute),
    )
  }

  const end = task.startMinute === null ? null : (task.startMinute + task.durationMinutes) % MINUTES_IN_DAY
  const time =
    task.startMinute === null
      ? ''
      : `${formatMinuteOfDay(task.startMinute)}–${formatMinuteOfDay(end ?? 0)}`

  return (
    <div
      className={cn(
        'absolute z-10 flex gap-2 overflow-hidden rounded-lg border bg-card p-2 text-left shadow-sm',
        block.overlaps && 'border-destructive/60 ring-1 ring-destructive/40',
        isHighlighted && 'ring-2 ring-primary',
        isDragging && 'z-30 opacity-80 shadow-lg',
        isClosed && 'opacity-70',
        draggable && 'cursor-grab touch-none active:cursor-grabbing',
      )}
      data-highlighted={isHighlighted || undefined}
      data-testid={`task-${task.id}`}
      ref={(element) => {
        setNodeRef(element)
        if (element && isHighlighted) element.scrollIntoView({ block: 'center' })
      }}
      style={{
        top: block.top,
        height: Math.max(block.height + stretchPx, scale.minBlockPx),
        left: `calc(${gutter} + (100% - ${gutter} - 0.5rem) * ${block.lane} / ${block.lanes})`,
        width: `calc((100% - ${gutter} - 0.5rem) / ${block.lanes} - 4px)`,
        transform: CSS.Translate.toString(transform),
      }}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      aria-roledescription={draggable ? 'задача на шкале, можно перетащить' : undefined}
    >
      <Checkbox
        aria-label={task.title}
        checked={task.outcome === 'done'}
        className="mt-0.5 shrink-0"
        data-testid={compact ? `today-task-done-${task.id}` : `task-done-${task.id}`}
        disabled={task.outcome === 'burned'}
        onCheckedChange={(checked) => onToggle(checked === true)}
        onPointerDown={(event) => event.stopPropagation()}
      />
      <button
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid={compact ? `today-task-${task.id}` : `task-open-${task.id}`}
        onClick={onOpen}
        type="button"
      >
        <span className="flex w-full min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn('size-2.5 shrink-0 rounded-full', color === null && 'bg-muted-foreground/40')}
            style={color ? { backgroundColor: color } : undefined}
          />
          <Typography
            className={cn('truncate', isClosed && 'line-through')}
            tone={isClosed ? 'muted' : undefined}
            variant="bodySmMedium"
          >
            {task.title}
          </Typography>
        </span>
        <Typography className="tabular-nums" tone="muted" variant="caption">
          {time} · {formatDuration(task.durationMinutes)}
          {label ? ` · ${label}` : ''}
          {task.repeat ? ' · повтор' : ''}
        </Typography>
        <span className="flex flex-wrap gap-1">
          {task.priority === 'urgent' && !isClosed ? <Badge variant="destructive">Срочно</Badge> : null}
          {task.priority === 'important' && !isClosed ? <Badge variant="outline">Важно</Badge> : null}
          {block.overlaps ? (
            <Badge data-testid={`task-overlap-${task.id}`} variant="outline">
              Пересечение
            </Badge>
          ) : null}
          {task.outcome === 'burned' ? <Badge variant="outline">Сгорела</Badge> : null}
        </span>
      </button>
      {!compact && !isClosed && onResize ? (
        <div
          aria-label={`Растянуть «${task.title}»`}
          className="absolute right-0 bottom-0 left-0 h-2 cursor-ns-resize touch-none"
          data-testid={`task-resize-${task.id}`}
          onPointerCancel={endStretch}
          onPointerDown={startStretch}
          onPointerMove={moveStretch}
          onPointerUp={endStretch}
          role="separator"
        />
      ) : null}
    </div>
  )
}

/**
 * «В течение дня»: tasks with no time. A task dragged here loses its time; one dragged from
 * here onto the timeline gets one (task 15).
 */
export function UnscheduledLane({
  categories,
  compact = false,
  onOpenTask,
  onToggle,
  tasks,
}: {
  categories: ReadonlyArray<TaskCategoryDto>
  compact?: boolean
  onOpenTask: (task: TaskDto) => void
  onToggle: (task: TaskDto, done: boolean) => void
  tasks: ReadonlyArray<TaskDto>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: unscheduledDropId, disabled: compact })
  return (
    <div
      className={cn(
        'flex min-h-14 flex-col gap-2 rounded-xl border border-dashed p-3',
        isOver && 'border-primary bg-primary/5',
      )}
      data-testid="day-unscheduled"
      ref={setNodeRef}
    >
      <Typography tone="muted" variant="eyebrow">
        В течение дня
      </Typography>
      {tasks.length === 0 ? (
        <Typography tone="muted" variant="caption">
          {compact ? 'Задач без времени нет.' : 'Перетащи сюда задачу, чтобы снять с неё время.'}
        </Typography>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tasks.map((task) => (
            <UnscheduledTask
              color={taskColor(task, categories)}
              compact={compact}
              key={task.id}
              onOpen={() => onOpenTask(task)}
              onToggle={(done) => onToggle(task, done)}
              task={task}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function UnscheduledTask({
  color,
  compact,
  onOpen,
  onToggle,
  task,
}: {
  color: string | null
  compact: boolean
  onOpen: () => void
  onToggle: (done: boolean) => void
  task: TaskDto
}) {
  const isClosed = task.outcome !== 'planned'
  const draggable = !compact && !isClosed
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({
    id: `task:${task.id}`,
    data: { kind: 'task', task },
    disabled: !draggable,
  })
  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5',
        isDragging && 'z-30 opacity-80 shadow-lg',
        draggable && 'cursor-grab touch-none',
      )}
      data-testid={`task-${task.id}`}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
    >
      <Checkbox
        aria-label={task.title}
        checked={task.outcome === 'done'}
        data-testid={compact ? `today-task-done-${task.id}` : `task-done-${task.id}`}
        disabled={task.outcome === 'burned'}
        onCheckedChange={(checked) => onToggle(checked === true)}
        onPointerDown={(event) => event.stopPropagation()}
      />
      <span
        aria-hidden="true"
        className={cn('size-2.5 shrink-0 rounded-full', color === null && 'bg-muted-foreground/40')}
        style={color ? { backgroundColor: color } : undefined}
      />
      <button
        className="min-w-0 flex-1 truncate text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid={compact ? `today-task-${task.id}` : `task-open-${task.id}`}
        onClick={onOpen}
        type="button"
      >
        <Typography
          className={cn(isClosed && 'line-through')}
          tone={isClosed ? 'muted' : undefined}
          variant="bodySm"
        >
          {task.title}
        </Typography>
      </button>
      {task.priority !== 'normal' && !isClosed ? (
        <Badge variant={task.priority === 'urgent' ? 'destructive' : 'outline'}>
          {task.priority === 'urgent' ? 'Срочно' : 'Важно'}
        </Badge>
      ) : null}
    </li>
  )
}
