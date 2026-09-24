/**
 * Links from account emails carry their token in the fragment (`#token=…`), so it never reaches
 * access logs or a referrer. Password reset and email confirmation read it the same way.
 */
export function readLinkToken(location: Pick<Location, 'hash'>) {
  return new URLSearchParams(location.hash.slice(1)).get('token') ?? ''
}

export function clearLinkTokenHash(
  location: Pick<Location, 'hash' | 'pathname' | 'search'>,
  history: Pick<History, 'replaceState' | 'state'>,
) {
  if (!location.hash) return
  history.replaceState(history.state, '', `${location.pathname}${location.search}`)
}
