import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatMinuteOfDay, parseMinuteOfDay } from '@/platform/intl'

type TimeFieldProps = {
  /** Minutes past midnight, or null for no time. */
  value: number | null
  onChange: (value: number | null) => void
  id?: string
  className?: string
  disabled?: boolean
  placeholder?: string
  'aria-label'?: string
  'data-testid'?: string
}

/**
 * A time of day typed as `8:30`, `08:30` or `0830`, always on the 24-hour clock. It replaces
 * `<input type="time">`, which shows AM/PM when the operating system is set to English.
 * An empty field means "no time"; a value that is not a real time is not passed on.
 */
export function TimeField({
  value,
  onChange,
  id,
  className,
  disabled,
  placeholder = 'чч:мм',
  'aria-label': ariaLabel,
  'data-testid': testId,
}: TimeFieldProps) {
  const [text, setText] = useState(value === null ? '' : formatMinuteOfDay(value))
  const [invalid, setInvalid] = useState(false)
  const [shownValue, setShownValue] = useState(value)

  // A value changed from outside (the form was reset, the task was saved) replaces the text.
  if (value !== shownValue) {
    setShownValue(value)
    setText(value === null ? '' : formatMinuteOfDay(value))
    setInvalid(false)
  }

  const commit = (next: string) => {
    if (next.trim() === '') {
      setInvalid(false)
      if (value !== null) onChange(null)
      return
    }
    const minute = parseMinuteOfDay(next)
    if (minute === null) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setText(formatMinuteOfDay(minute))
    if (minute !== value) onChange(minute)
  }

  return (
    <Input
      aria-invalid={invalid || undefined}
      aria-label={ariaLabel}
      autoComplete="off"
      className={cn('tabular-nums', className)}
      data-testid={testId}
      disabled={disabled}
      id={id}
      inputMode="numeric"
      maxLength={5}
      onBlur={() => commit(text)}
      onChange={(event) => {
        setText(event.target.value)
        // Commit as soon as the text is a whole time, so a form submitted by Enter sees it.
        const minute = parseMinuteOfDay(event.target.value)
        if (minute !== null && event.target.value.trim().length >= 4) {
          setInvalid(false)
          if (minute !== value) onChange(minute)
        } else if (event.target.value.trim() === '' && value !== null) {
          onChange(null)
        }
      }}
      placeholder={placeholder}
      value={text}
    />
  )
}
