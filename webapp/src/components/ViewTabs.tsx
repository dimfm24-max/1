import { Button } from '@/components/ui/button'

export type ViewTab<T extends string> = { id: T; label: string }

/**
 * A row of views of one screen, such as the calendar's month and horizon. The chosen view lives
 * in the address, so the caller decides what selecting one does.
 */
export function ViewTabs<T extends string>({
  active,
  label,
  onSelect,
  tabs,
  testId,
}: {
  active: T
  label: string
  onSelect: (id: T) => void
  tabs: ReadonlyArray<ViewTab<T>>
  testId?: string
}) {
  return (
    <div aria-label={label} className="flex flex-wrap gap-1" data-testid={testId} role="tablist">
      {tabs.map((tab) => (
        <Button
          aria-selected={tab.id === active}
          data-testid={testId ? `${testId}-${tab.id}` : undefined}
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          role="tab"
          size="sm"
          type="button"
          variant={tab.id === active ? 'secondary' : 'ghost'}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  )
}
