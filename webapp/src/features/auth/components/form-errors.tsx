import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function FormAlert({
  message,
  title = 'Не получилось',
  testId = 'form-error',
}: {
  message: string | null
  title?: string
  testId?: string
}) {
  if (!message) return null

  return (
    <Alert data-testid={testId} variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
