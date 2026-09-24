export class HabitsFailure extends Error {
  constructor(
    readonly kind: 'not_found',
    message: string,
  ) {
    super(message)
    this.name = 'HabitsFailure'
  }
}
