import {
  avatarContentTypeSchema,
  AVATAR_MAX_BYTES,
  AVATAR_MIN_BYTES,
  type AvatarContentType,
  type UploadTicket,
} from '@dilife/contracts'

export type AvatarUploadFailure =
  /** The picked file is not a type or size the backend will issue a ticket for. */
  | 'unsupported-file'
  /** The file changed between asking for the ticket and sending it. */
  | 'size-changed'
  /** The network or the storage endpoint refused the transfer. */
  | 'transfer-failed'

export class AvatarUploadError extends Error {
  readonly reason: AvatarUploadFailure

  constructor(reason: AvatarUploadFailure, message: string) {
    super(message)
    this.name = 'AvatarUploadError'
    this.reason = reason
  }
}

/**
 * Browsers disagree about HEIC: Safari may report `image/heif`, and some report nothing at all
 * for a file picked from a phone. Falling back to the extension keeps a legitimate photo
 * uploadable, while anything still unrecognised is refused before a ticket is requested.
 */
export function resolveAvatarContentType(file: File): AvatarContentType | null {
  const declared = avatarContentTypeSchema.safeParse(file.type.toLowerCase())
  if (declared.success) return declared.data

  const extension = file.name.toLowerCase().split('.').pop()
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'
  if (extension === 'heic') return 'image/heic'
  if (extension === 'heif') return 'image/heif'

  return null
}

/** How the picked file reaches the backend: as it is, or redrawn as JPEG in the browser. */
export type AvatarFileKind = 'as-is' | 'convert' | 'unsupported'

/**
 * JPEG and PNG go up as they are. WebP and HEIC are redrawn as JPEG first: Chrome and Firefox
 * cannot show a stored HEIC, and a WebP value in the avatar contract would break the parse in an
 * installed mobile build. HEIC decodes only where the browser can read it, mostly Safari.
 */
export function classifyAvatarFile(file: File): AvatarFileKind {
  const type = file.type.toLowerCase()
  const extension = file.name.toLowerCase().split('.').pop()
  if (type === 'image/jpeg' || type === 'image/png') return 'as-is'
  if (type === 'image/webp' || type === 'image/heic' || type === 'image/heif') return 'convert'
  if (type === '' || type === 'application/octet-stream') {
    if (extension === 'jpg' || extension === 'jpeg' || extension === 'png') return 'as-is'
    if (extension === 'webp' || extension === 'heic' || extension === 'heif') return 'convert'
  }
  return 'unsupported'
}

/** Longest side of a redrawn photo: sharp in the header and far below the 5 MB limit. */
const convertedMaxSide = 1024

export async function prepareAvatarFile(file: File): Promise<File> {
  const kind = classifyAvatarFile(file)
  if (kind === 'as-is') return file
  if (kind === 'unsupported') {
    throw new AvatarUploadError('unsupported-file', 'Выбери фото в JPEG, PNG, WebP или HEIC.')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new AvatarUploadError(
      'unsupported-file',
      'Этот браузер не может открыть такое фото. Сохрани его как JPEG или PNG и выбери снова.',
    )
  }

  const scale = Math.min(1, convertedMaxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new AvatarUploadError('unsupported-file', 'Не получилось подготовить фото. Выбери JPEG или PNG.')
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  if (!blob) {
    throw new AvatarUploadError('unsupported-file', 'Не получилось подготовить фото. Выбери JPEG или PNG.')
  }
  const name = `${file.name.replace(/\.[^.]*$/, '') || 'photo'}.jpg`
  return new File([blob], name, { type: 'image/jpeg' })
}

export function describeAvatarFile(file: File) {
  const contentType = resolveAvatarContentType(file)

  if (!contentType) {
    return { ok: false as const, reason: 'type' as const }
  }
  if (file.size < AVATAR_MIN_BYTES) {
    return { ok: false as const, reason: 'too-small' as const }
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false as const, reason: 'too-large' as const }
  }

  return { ok: true as const, contentType, byteSize: file.size }
}

/**
 * Sends the file straight at the storage endpoint using the ticket's headers verbatim.
 *
 * A 412 is treated as success rather than an error. The upload key is signed write-once, so 412
 * means "this exact object is already stored" - which is what a retry after a dropped connection
 * looks like when the first attempt actually landed. Reporting it as a failure would leave the
 * user stuck on an upload that has, in fact, completed.
 */
export async function uploadAvatarObject(ticket: UploadTicket, file: File) {
  if (file.size !== ticket.contentLength) {
    throw new AvatarUploadError(
      'size-changed',
      'Файл изменился во время загрузки. Выбери его снова.',
    )
  }

  let response: Response
  try {
    response = await fetch(ticket.url, {
      method: ticket.method,
      headers: ticket.headers,
      body: file,
      // The ticket carries its own authority; sending cookies would only break the preflight.
      credentials: 'omit',
      mode: 'cors',
    })
  } catch {
    throw new AvatarUploadError(
      'transfer-failed',
      'Не удалось связаться с хранилищем. Проверь интернет и попробуй ещё раз.',
    )
  }

  if (!response.ok && response.status !== 412) {
    throw new AvatarUploadError(
      'transfer-failed',
      'Хранилище не приняло файл. Попробуй другой.',
    )
  }
}
