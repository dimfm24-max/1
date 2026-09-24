import { useId } from 'react'

import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Colours offered for categories and tasks. Each keeps at least 3:1 against the card in both
 * themes, so a dot or a stripe in it is visible on dark and light (task 14).
 */
const presetColors = [
  '#3b82f6',
  '#16a34a',
  '#ea580c',
  '#a855f7',
  '#db2777',
  '#0891b2',
  '#ca8a04',
  '#64748b',
] as const

/** A row of ready colours and a free choice. `value` is `#rrggbb` or null for none. */
export function ColorPicker({
  allowNone = false,
  disabled,
  label,
  noneLabel = 'Без цвета',
  onChange,
  value,
}: {
  allowNone?: boolean
  disabled?: boolean
  label: string
  noneLabel?: string
  onChange: (color: string | null) => void
  value: string | null
}) {
  const customId = useId()
  const isPreset = value !== null && (presetColors as readonly string[]).includes(value.toLowerCase())

  return (
    <div aria-label={label} className="flex flex-wrap items-center gap-2" role="radiogroup">
      {allowNone ? (
        <Button
          aria-checked={value === null}
          disabled={disabled}
          onClick={() => onChange(null)}
          role="radio"
          size="sm"
          type="button"
          variant={value === null ? 'secondary' : 'ghost'}
        >
          {noneLabel}
        </Button>
      ) : null}
      {presetColors.map((color) => (
        <button
          aria-checked={value?.toLowerCase() === color}
          aria-label={color}
          className={cn(
            'size-8 rounded-full border-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            value?.toLowerCase() === color ? 'border-foreground' : 'border-transparent',
          )}
          disabled={disabled}
          key={color}
          onClick={() => onChange(color)}
          role="radio"
          style={{ backgroundColor: color }}
          type="button"
        />
      ))}
      <label
        className={cn(
          'relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2',
          value !== null && !isPreset ? 'border-foreground' : 'border-dashed border-muted-foreground',
        )}
        htmlFor={customId}
        style={value !== null && !isPreset ? { backgroundColor: value } : undefined}
        title="Свой цвет"
      >
        <Typography as="span" variant="srOnly">
          Свой цвет
        </Typography>
        <input
          className="absolute inset-0 cursor-pointer opacity-0"
          disabled={disabled}
          id={customId}
          onChange={(event) => onChange(event.target.value)}
          type="color"
          value={value ?? '#3b82f6'}
        />
      </label>
    </div>
  )
}
