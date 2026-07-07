import { z } from 'zod'

/**
 * Error messages for the API config schema.
 * Pass localized strings to `createApiConfigSchema()` for i18n support.
 */
export interface ApiConfigMessages {
  endpointInvalid: string
  apiKeyMin: string
  timeoutMin: string
  timeoutMax: string
  retryMin: string
  retryMax: string
}

/** Default English error messages */
export const defaultApiConfigMessages: ApiConfigMessages = {
  endpointInvalid: 'Must be a valid URL',
  apiKeyMin: 'API key must be at least 10 characters',
  timeoutMin: 'Timeout must be at least 1 second',
  timeoutMax: 'Timeout must not exceed 300 seconds',
  retryMin: 'Retry count must be at least 0',
  retryMax: 'Retry count must not exceed 10',
}

/**
 * Schema factory for the API configuration form.
 *
 * Follows the schema-first approach: the zod schema is the single source of
 * truth for validation rules and TypeScript types are inferred from it.
 *
 * @param messages - Localized error messages
 */
export function createApiConfigSchema(messages: ApiConfigMessages) {
  return z.object({
    endpoint: z.string().url(messages.endpointInvalid),
    apiKey: z.string().min(10, messages.apiKeyMin),
    timeoutSeconds: z
      .number()
      .min(1, messages.timeoutMin)
      .max(300, messages.timeoutMax),
    retryCount: z.number().min(0, messages.retryMin).max(10, messages.retryMax),
    debugMode: z.boolean(),
  })
}

/** Default schema instance with English messages */
export const apiConfigSchema = createApiConfigSchema(defaultApiConfigMessages)

/** Form values type inferred from the schema (schema-first) */
export type ApiConfigFormValues = z.infer<typeof apiConfigSchema>

/** Default form values for initial render */
export const apiConfigDefaults: ApiConfigFormValues = {
  endpoint: '',
  apiKey: '',
  timeoutSeconds: 30,
  retryCount: 3,
  debugMode: false,
}
