/**
 * Reload the running window.
 *
 * A module instead of a bare `window.location.reload()` at the call site because
 * `location` is an unforgeable global: no test realm can replace it, so the call
 * was only ever observable by reaching into the component. Mocking this module is
 * pool-independent, matching how `recovery`, `sentry` and `logger` are already
 * handled in the error-boundary tests. Excluded from coverage for the same reason
 * as the entry points — its body is one browser navigation.
 */
export function reloadApplication(): void {
  window.location.reload()
}
