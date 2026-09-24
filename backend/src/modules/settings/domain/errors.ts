export class SettingsFailure extends Error {
  constructor(
    readonly kind: 'unknown_time_zone',
    message: string,
  ) {
    super(message)
    this.name = 'SettingsFailure'
  }
}
