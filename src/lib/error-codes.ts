/**
 * Stable error codes mirrored from Rust `AppError::error_code()`.
 *
 * These codes MUST stay in sync with `src-tauri/src/error.rs`.
 * The frontend uses these codes to switch on error type without
 * parsing human-readable messages.
 *
 * @see src-tauri/src/error.rs — `AppError::error_code()`
 */
export const ErrorCode = {
  IO: 'ERR_IO',
  SERIALIZATION: 'ERR_SERIALIZATION',
  PATH: 'ERR_PATH',
  VALIDATION: 'ERR_VALIDATION',
  NOT_FOUND: 'ERR_NOT_FOUND',
  TASK_JOIN: 'ERR_TASK_JOIN',
  TRAY: 'ERR_TRAY',
  QUICK_PANE: 'ERR_QUICK_PANE',
  NOTIFICATION: 'ERR_NOTIFICATION',
  WINDOW: 'ERR_WINDOW',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

/**
 * All valid error code values for runtime validation.
 */
export const ERROR_CODES: readonly string[] = Object.values(ErrorCode)

/**
 * Type guard to check if a string is a valid error code.
 */
export function isErrorCode(value: string): value is ErrorCode {
  return ERROR_CODES.includes(value)
}
