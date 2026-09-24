import { useTheme } from 'next-themes'

import {
  Moon02Icon,
  Sun01Icon,
  ComputerIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Typography } from '@/components/typography'

const themes = ['system', 'light', 'dark'] as const
type Theme = typeof themes[number]

const themeLabels = {
  system: 'Как в системе',
  light: 'Светлая',
  dark: 'Тёмная',
} as const

const themeIcons = {
  system: ComputerIcon,
  light: Sun01Icon,
  dark: Moon02Icon,
} as const

export function AppearancePanel() {
  const { theme = 'system', setTheme } = useTheme()
  const selectedTheme = isTheme(theme) ? theme : 'system'

  return (
    <Card>
      <CardHeader>
        <Typography as="h2" variant="h6">
          Оформление
        </Typography>
        <CardDescription>
          Тёмная, светлая или как в системе.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel htmlFor="appearance-theme">Тема</FieldLabel>
          <Select
            onValueChange={(value) => {
              if (isTheme(value)) setTheme(value)
            }}
            value={selectedTheme}
          >
            <SelectTrigger className="w-full sm:w-52" id="appearance-theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {themes.map((item) => (
                <SelectItem key={item} value={item}>
                  <HugeiconsIcon aria-hidden icon={themeIcons[item]} strokeWidth={2} />
                  {themeLabels[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Меняется сразу и запоминается в этом браузере.
          </FieldDescription>
        </Field>
      </CardContent>
    </Card>
  )
}

function isTheme(value: string): value is Theme {
  return themes.some((theme) => theme === value)
}
