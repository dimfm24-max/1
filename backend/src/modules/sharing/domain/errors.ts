export class SharingFailure extends Error {
  constructor(
    readonly kind: 'not_found',
    message: string,
  ) {
    super(message)
    this.name = 'SharingFailure'
  }
}
