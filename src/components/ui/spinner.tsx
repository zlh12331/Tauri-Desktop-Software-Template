import { Loader2Icon } from 'lucide-react'

import { cn } from '@/lib/utils'
import i18n from '@/i18n/config'

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <Loader2Icon
      role="status"
      aria-label={i18n.t('common.loading')}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
