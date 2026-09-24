import { Toggle } from '@/components/ui/toggle'
import { weekdaysMondayFirst as weekdays } from '@/platform/intl'

/** Days of the week switched on and off, for repeats, templates and habits. */
export function WeekdayPicker({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled?: boolean
  label: string
  onChange: (days: number[]) => void
  value: ReadonlyArray<number>
}) {
  return (
    <div aria-label={label} className="flex flex-wrap gap-1" role="group">
      {weekdays.map((day) => (
        <Toggle
          aria-label={day.name}
          data-testid={`weekday-${day.value}`}
          disabled={disabled}
          key={day.value}
          onPressedChange={(pressed) =>
            onChange(
              pressed
                ? [...value, day.value].sort((a, b) => a - b)
                : value.filter((other) => other !== day.value),
            )
          }
          pressed={value.includes(day.value)}
          size="sm"
          variant="outline"
        >
          {day.short}
        </Toggle>
      ))}
    </div>
  )
}
