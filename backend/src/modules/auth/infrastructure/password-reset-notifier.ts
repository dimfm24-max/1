import { isPermanentEmailError, type EmailDelivery, type EmailMessage } from '../../../email'
import { TerminalTaskError } from '../../../outbox'
import { emailVerificationTokenTtlHours, type PasswordResetNotifier } from '../application/ports'

/**
 * Turns the two account emails into provider-neutral messages, and provider failures into outbox
 * outcomes.
 *
 * This is the seam where "the provider will never accept this address" becomes "this task can
 * never succeed": the email module knows nothing about tasks, and the drain retries everything
 * that is not a `TerminalTaskError`, so somebody has to translate. Auth infrastructure is the
 * right somebody - it already owns the other direction, queueing the task in the first place.
 */
/** Subjects are exported so tests can find a message without repeating its wording. */
export const passwordResetSubject = 'DiLife: смена пароля'
export const passwordChangedSubject = 'DiLife: пароль изменён'
export const emailVerificationSubject = 'DiLife: подтверди почту'

export function createPasswordResetNotifier(
  emailDelivery: EmailDelivery,
  webappOrigin: string,
  now: () => Date = () => new Date(),
): PasswordResetNotifier {
  async function send(message: EmailMessage, signal: AbortSignal) {
    try {
      await emailDelivery.send(message, { signal })
    } catch (error) {
      if (isPermanentEmailError(error)) {
        // The provider's status and code are folded into the message, not left on `cause`: the
        // drain persists `error.message` alone into `task_outbox.last_error` and never walks the
        // chain. Without this, the rows that stay `failed` forever - the only ones an operator
        // still has to diagnose after the payload is blanked - would be the least informative
        // ones. `EmailDeliveryError` messages are PII-free by contract, so this is safe to keep.
        throw new TerminalTaskError(
          `The email provider rejected this message permanently: ${(error as Error).message}`,
          { cause: error },
        )
      }
      throw error
    }
  }

  return {
    configured: emailDelivery.configured,
    isPermanentFailure: (error) => error instanceof TerminalTaskError,
    async sendPasswordReset({ email, expiresAt, token }, signal) {
      const resetUrl = new URL('/reset-password', webappOrigin)
      resetUrl.hash = new URLSearchParams({ token }).toString()
      await send(
        {
          to: email,
          subject: passwordResetSubject,
          text: [
            'Чтобы задать новый пароль, открой ссылку:',
            resetUrl.toString(),
            // The account has no time zone here, so the deadline is a duration rather than a
            // clock time that would be wrong for most readers.
            `Ссылка действует ${describeMinutesLeft(expiresAt, now())}.`,
            'Если ты не просил сменить пароль, просто не отвечай на это письмо.',
          ].join('\n\n'),
        },
        signal,
      )
    },
    async sendEmailVerification({ email, token }, signal) {
      // Outside /app, next to /reset-password: the link has to work on a device with no session.
      const verifyUrl = new URL('/verify-email', webappOrigin)
      verifyUrl.hash = new URLSearchParams({ token }).toString()
      await send(
        {
          to: email,
          subject: emailVerificationSubject,
          text: [
            'Привет! Это DiLife. Подтверди, что это твоя почта, — открой ссылку:',
            verifyUrl.toString(),
            `Ссылка действует ${emailVerificationTokenTtlHours} часа. Если она устарела, в приложении есть кнопка «Отправить письмо ещё раз».`,
            'Если ты не регистрировался в DiLife, просто не отвечай на это письмо.',
          ].join('\n\n'),
        },
        signal,
      )
    },
    async sendPasswordChanged({ email }, signal) {
      await send(
        {
          to: email,
          subject: passwordChangedSubject,
          text: [
            'Пароль от DiLife изменён. Все входы на других устройствах завершены.',
            'Если это был не ты, сразу задай новый пароль: «Забыл пароль?» на странице входа.',
          ].join('\n\n'),
        },
        signal,
      )
    },
  }
}

function describeMinutesLeft(expiresAt: Date, now: Date): string {
  const minutes = Math.max(1, Math.round((expiresAt.getTime() - now.getTime()) / 60_000))
  const tail = minutes % 100
  const last = minutes % 10
  const word =
    tail >= 11 && tail <= 14
      ? 'минут'
      : last === 1
        ? 'минуту'
        : last >= 2 && last <= 4
          ? 'минуты'
          : 'минут'
  return `ещё ${minutes} ${word}`
}
