import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { SettingsSection } from '../shared/SettingsComponents'
import {
  createApiConfigSchema,
  apiConfigDefaults,
  type ApiConfigFormValues,
} from '@/lib/schemas/api-config'
import { logger } from '@/lib/logger'

/**
 * ApiConfigForm — Example form demonstrating react-hook-form + zod integration.
 *
 * Showcases the schema-first approach:
 * - Zod schema defines validation rules (URL, min length, number range)
 * - TypeScript types are inferred from the schema via `z.infer`
 * - `zodResolver` connects the schema to react-hook-form
 * - shadcn/ui Form components provide accessible labels, descriptions, and errors
 */
export function ApiConfigForm() {
  const { t } = useTranslation()

  // Create schema with localized error messages
  const schema = useMemo(
    () =>
      createApiConfigSchema({
        endpointInvalid: t('preferences.advanced.apiConfig.error.endpoint'),
        apiKeyMin: t('preferences.advanced.apiConfig.error.apiKey'),
        timeoutMin: t('preferences.advanced.apiConfig.error.timeoutMin'),
        timeoutMax: t('preferences.advanced.apiConfig.error.timeoutMax'),
        retryMin: t('preferences.advanced.apiConfig.error.retryMin'),
        retryMax: t('preferences.advanced.apiConfig.error.retryMax'),
      }),
    [t]
  )

  const form = useForm<ApiConfigFormValues>({
    resolver: zodResolver(schema),
    defaultValues: apiConfigDefaults,
  })

  const onSubmit = async (values: ApiConfigFormValues) => {
    try {
      logger.info('Saving API configuration', { endpoint: values.endpoint })
      // Simulate async save — replace with actual backend call
      await new Promise(resolve => setTimeout(resolve, 800))
      toast.success(t('preferences.advanced.apiConfig.saveSuccess'))
      logger.info('API configuration saved', values)
    } catch (error) {
      logger.error('Failed to save API configuration', { error })
      toast.error(t('preferences.advanced.apiConfig.saveError'))
    }
  }

  return (
    <SettingsSection title={t('preferences.advanced.apiConfig.title')}>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="endpoint"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('preferences.advanced.apiConfig.endpoint')}
                </FormLabel>
                <FormControl>
                  <Input
                    type="url"
                    placeholder="https://api.example.com"
                    autoComplete="url"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t('preferences.advanced.apiConfig.endpointDescription')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="apiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('preferences.advanced.apiConfig.apiKey')}
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder={t(
                      'preferences.advanced.apiConfig.apiKeyPlaceholder'
                    )}
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t('preferences.advanced.apiConfig.apiKeyDescription')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="timeoutSeconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('preferences.advanced.apiConfig.timeout')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={300}
                      {...field}
                      onChange={e => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('preferences.advanced.apiConfig.timeoutDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="retryCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('preferences.advanced.apiConfig.retries')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      {...field}
                      onChange={e => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('preferences.advanced.apiConfig.retriesDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="debugMode"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>
                    {t('preferences.advanced.apiConfig.debugMode')}
                  </FormLabel>
                  <FormDescription>
                    {t('preferences.advanced.apiConfig.debugModeDescription')}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? t('preferences.advanced.apiConfig.saving')
              : t('preferences.advanced.apiConfig.save')}
          </Button>
        </form>
      </Form>
    </SettingsSection>
  )
}
