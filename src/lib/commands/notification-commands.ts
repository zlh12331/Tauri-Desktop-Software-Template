import type { AppCommand } from './types'
import { notifications } from '@/lib/notifications'
import i18n from '@/i18n/config'

export const notificationCommands: AppCommand[] = [
  {
    id: 'notification.test-toast',
    labelKey: 'commands.testToast.label',
    descriptionKey: 'commands.testToast.description',
    group: 'debug',
    keywords: ['test', 'toast', 'notification', 'debug'],
    async execute() {
      await notifications.success(
        i18n.t('toast.success.testToast'),
        i18n.t('toast.success.testToastDescription')
      )
    },
  },
]
