import { Calendar03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { ru } from 'react-day-picker/locale'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { formatDate } from '@/platform/intl'

type DateFieldProps = {
  /** `YYYY-MM-DD`, or `''` for no date yet. */
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
  disabled?: boolean
  placeholder?: string
  /** Earliest selectable day, `YYYY-MM-DD`. */
  min?: string
  /** Latest selectable day, `YYYY-MM-DD`. */
  max?: string
  /** Years offered in a year dropdown, for dates far from today such as a birthday. */
  yearRange?: { from: number; to: number }
  'aria-label'?: string
  'aria-invalid'?: boolean
  'data-testid'?: string
}

/**
 * A date picked in a calendar and shown as `21.09.2026`. It replaces `<input type="date">`,
 * whose format follows the operating system and shows `mm/dd/yyyy` on an English one.
 */
export function DateField({
  value,
  onChange,
  id,
  className,
  disabled,
  placeholder = 'Выбери дату',
  min,
  max,
  yearRange,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  'data-testid': testId,
}: DateFieldProps) {
  const [open, setOpen] = useState(false)
  const selected = value === '' ? undefined : toDate(value)

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel ? `${ariaLabel}: ${value === '' ? placeholder : formatDate(value)}` : undefined}
          className={cn('justify-start', value === '' && 'text-muted-foreground', className)}
          data-testid={testId}
          data-value={value}
          disabled={disabled}
          id={id}
          type="button"
          variant="outline"
        >
          <HugeiconsIcon aria-hidden data-icon="inline-start" icon={Calendar03Icon} strokeWidth={2} />
          {value === '' ? placeholder : formatDate(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          captionLayout={yearRange ? 'dropdown' : 'label'}
          defaultMonth={selected}
          disabled={[
            ...(min ? [{ before: toDate(min) }] : []),
            ...(max ? [{ after: toDate(max) }] : []),
          ]}
          locale={ru}
          mode="single"
          onSelect={(date) => {
            if (!date) return
            onChange(fromDate(date))
            setOpen(false)
          }}
          selected={selected}
          {...(yearRange
            ? {
                startMonth: new Date(yearRange.from, 0, 1),
                endMonth: new Date(yearRange.to, 11, 31),
              }
            : {})}
          weekStartsOn={1}
        />
      </PopoverContent>
    </Popover>
  )
}

// The calendar works in local dates; the value is a plain calendar day. Building the Date from
// its parts (not by parsing a string) keeps both ends free of time zone shifts.
function toDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year!, (month ?? 1) - 1, day ?? 1)
}

function fromDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
