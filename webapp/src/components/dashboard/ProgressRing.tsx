import type { ReactNode } from 'react'

/**
 * A percentage drawn as a ring, with its figure in the middle. The ring is one image to
 * assistive technology, so `label` has to say the number in words.
 */
export function ProgressRing({
  children,
  label,
  size = 136,
  value,
}: {
  children?: ReactNode
  label: string
  size?: number
  value: number
}) {
  const stroke = Math.round(size / 10)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const percent = Math.min(Math.max(value, 0), 100)

  return (
    <div
      aria-label={label}
      className="relative shrink-0"
      role="img"
      style={{ height: size, width: size }}
    >
      <svg aria-hidden="true" className="-rotate-90" height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <circle
          className="stroke-border"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          strokeWidth={stroke}
        />
        <circle
          className="stroke-primary transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          // A round cap on an empty ring would still paint a dot at the start.
          strokeLinecap={percent > 0 ? 'round' : 'butt'}
          strokeWidth={stroke}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
