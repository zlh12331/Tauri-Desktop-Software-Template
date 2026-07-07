/**
 * Sensitive data redaction for logs and Sentry events.
 *
 * Mirrors the Rust-side `utils::redact::redact_sensitive()` function.
 * Replaces values of sensitive keys (api_key, token, authorization, etc.)
 * with `***` to prevent accidental credential leakage through log files
 * or Sentry events.
 *
 * @see src-tauri/src/utils/redact.rs
 */

const SENSITIVE_VALUE_PATTERN =
  /((?:access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|password|secret|cookie|token)\s*[:=]\s*"?)[^\s",}\]]+/gi

const SENSITIVE_KEY_NAMES =
  /^(?:access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|password|secret|cookie|token)$/i

/**
 * Replace sensitive values in a string with `***`.
 *
 * @example
 * ```ts
 * redactString('api_key=abc123') // 'api_key=***'
 * redactString('"token": "xyz"') // '"token": "***"'
 * ```
 */
export function redactString(input: string): string {
  return input.replace(SENSITIVE_VALUE_PATTERN, '$1***')
}

/**
 * Returns `true` if the key name is considered sensitive.
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_NAMES.test(key)
}

/**
 * Deeply redact sensitive values in an object.
 *
 * For object properties whose key name matches a sensitive pattern,
 * the entire value is replaced with `'***'`. String values within
 * the object are also passed through `redactString`.
 */
export function redactObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return redactString(obj) as unknown as T
  }
  if (Array.isArray(obj)) {
    return obj.map(redactObject) as unknown as T
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (isSensitiveKey(key)) {
        result[key] = '***'
      } else {
        result[key] = redactObject(value)
      }
    }
    return result as unknown as T
  }
  return obj
}
