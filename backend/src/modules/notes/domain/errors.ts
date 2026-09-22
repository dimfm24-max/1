export class NotesFailure extends Error {
  constructor(
    readonly kind: 'not_found',
    message: string,
  ) {
    super(message)
    this.name = 'NotesFailure'
  }
}
