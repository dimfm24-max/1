import type { ApiErrorCode } from '@dilife/contracts'

import { ApiRequestError } from './http-client'

// Russian text for every error code the contract knows. The server's own `message` is English
// and written for developers, so the interface never shows it; it shows this table instead.
const messages: Record<ApiErrorCode, string> = {
  BAD_REQUEST: 'Запрос не получился. Проверь введённые данные.',
  UNAUTHORIZED: 'Нужно войти снова.',
  FORBIDDEN: 'На это нет прав.',
  NOT_FOUND: 'Не нашлось: возможно, это уже удалено.',
  CONFLICT: 'Данные успели измениться. Обнови страницу и попробуй ещё раз.',
  VALIDATION_ERROR: 'Проверь введённые данные.',
  AUTH_EMAIL_ALREADY_EXISTS: 'С этой почтой уже есть аккаунт. Войди или восстанови пароль.',
  AUTH_INVALID_PROVIDER_TOKEN: 'Вход не получился. Попробуй ещё раз.',
  AUTH_PROVIDER_ACCOUNT_ALREADY_LINKED: 'Этот аккаунт уже связан с другим входом.',
  AUTH_PROVIDER_EMAIL_REQUIRED: 'Для входа нужна почта.',
  AUTH_PROVIDER_NOT_CONFIGURED: 'Такой вход сейчас недоступен.',
  AUTH_PROVIDER_UNAVAILABLE: 'Такой вход сейчас недоступен. Попробуй позже.',
  PAYLOAD_TOO_LARGE: 'Слишком много данных за раз. Сократи текст или файл.',
  RATE_LIMITED: 'Слишком много попыток. Подожди минуту и попробуй снова.',
  AUTH_EMAIL_VERIFICATION_INVALID:
    'Ссылка для подтверждения устарела или уже использована. Отправь письмо ещё раз из приложения.',
  AUTH_PASSWORD_RESET_INVALID: 'Ссылка для смены пароля устарела или уже использована. Запроси новую.',
  UPLOAD_NOT_COMPLETED: 'Файл не догрузился. Отправь его ещё раз.',
  UPLOAD_REJECTED: 'Этот файл не подходит. Выбери другой.',
  UPLOAD_EXPIRED: 'Загрузка заняла слишком много времени. Выбери файл заново.',
  LIFE_GOAL_REQUIRED: 'Сначала назови дело своей жизни.',
  GOAL_PROGRESS_NOT_MANUAL: 'Эта цель считает продвижение сама, по выполненным шагам.',
  GOAL_DEADLINE_IN_PAST: 'Срок не может быть в прошлом. Выбери сегодняшний день или позже.',
  GOAL_CLOSED: 'Цель закрыта. Верни её в работу, чтобы изменить.',
  TASK_STEP_CANNOT_REPEAT: 'Шаг цели не повторяется: ставь его в план на нужные дни сам.',
  TASK_ALREADY_RESOLVED: 'С этой задачей уже решено.',
  INTERNAL_ERROR: 'На сервере что-то сломалось. Попробуй ещё раз чуть позже.',
}

// Login answers 401 for a wrong password; there "log in again" would be the wrong advice.
const unauthorizedOnLogin = 'Почта или пароль не подходят.'

export const networkErrorMessage = 'Нет связи с сервером. Проверь интернет и попробуй ещё раз.'

/**
 * The sentence to show for a failed request. `fallback` covers errors that are not API errors
 * at all - a bug, a parse failure - and should say what the person was trying to do.
 */
export function describeApiError(
  error: unknown,
  fallback: string,
  options: { unauthorized?: 'login' } = {},
): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401 && options.unauthorized === 'login') return unauthorizedOnLogin
    return messages[error.code as ApiErrorCode] ?? fallback
  }
  // `fetch` rejects with a TypeError when the network or the server cannot be reached.
  if (error instanceof TypeError) return networkErrorMessage
  return fallback
}
