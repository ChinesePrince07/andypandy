import { Button, FormHelperText } from '@afilmory/ui'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LinearBorderPanel } from '~/components/common/LinearBorderPanel'

import type { TenantDomain } from '../types'
import { DomainBadge } from './DomainBadge'

interface DomainListItemProps {
  domain: TenantDomain
  onVerify: (id: string) => void
  onDelete: (id: string) => void
  isVerifying: boolean
  isDeleting: boolean
}

export function DomainListItem({ domain, onVerify, onDelete, isVerifying, isDeleting }: DomainListItemProps) {
  const { t } = useTranslation()

  return (
    <LinearBorderPanel className="bg-background p-4 transition-all duration-200 hover:bg-fill/30">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap min-w-0 flex-1">
            <span className="text-sm font-semibold text-text break-all">{domain.domain}</span>
            <DomainBadge status={domain.status} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {domain.status === 'pending' ? (
              <Button variant="secondary" size="sm" onClick={() => onVerify(domain.id)} isLoading={isVerifying}>
                {t('settings.domain.actions.verify')}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(domain.id)}
              disabled={isDeleting}
              className="text-text-tertiary hover:text-red"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {domain.status === 'pending' ? (
          <LinearBorderPanel className="bg-fill/50 p-3">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                {t('settings.domain.token.label')}
              </p>
              <code className="block w-full rounded-lg bg-background border border-fill-tertiary px-3 py-2 text-xs font-mono text-text break-all">
                {domain.verificationToken}
              </code>
              <FormHelperText className="text-xs text-text-tertiary">
                {t('settings.domain.token.helper')}
              </FormHelperText>
            </div>
          </LinearBorderPanel>
        ) : null}
      </div>
    </LinearBorderPanel>
  )
}
