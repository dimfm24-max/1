import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Typography } from '@/components/typography'

export type SettingsSection = {
  id: string
  label: string
}

/**
 * The frame of «Настройки»: a list of sections and the open one. Each section is its own
 * address, `/app/settings/<id>`, so a section can be linked to and survives a reload.
 */
export function SettingsLayout({
  active,
  children,
  sections,
}: {
  active: string
  children: ReactNode
  sections: ReadonlyArray<SettingsSection>
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col md:flex-row">
      <nav
        aria-label="Разделы настроек"
        className="shrink-0 border-b p-4 md:w-60 md:border-r md:border-b-0 md:p-6"
        data-testid="settings-nav"
      >
        <Typography as="h1" className="mb-3 hidden md:block" variant="h5">
          Настройки
        </Typography>
        <ul className="flex gap-1 overflow-x-auto md:flex-col">
          {sections.map((section) => (
            <li className="shrink-0" key={section.id}>
              <Button
                asChild
                className="w-full justify-start"
                size="sm"
                variant={section.id === active ? 'secondary' : 'ghost'}
              >
                <Link
                  aria-current={section.id === active ? 'page' : undefined}
                  data-testid={`settings-nav-${section.id}`}
                  params={{ section: section.id }}
                  to="/app/settings/$section"
                >
                  {section.label}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1" data-testid={`settings-section-${active}`}>
        {children}
      </div>
    </div>
  )
}
