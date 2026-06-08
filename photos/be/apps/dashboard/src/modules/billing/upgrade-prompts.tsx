import type { ModalComponent } from '@afilmory/ui'
import { Button, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Modal } from '@afilmory/ui'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { getRequestErrorCode, getRequestStatusCode } from '~/lib/errors'
import { ManagedStoragePlansModal } from '~/modules/storage-providers/components/ManagedStoragePlansModal'

const PLAN_LIMIT_CODE = 40
const STORAGE_LIMIT_CODE = 41

export type BillingUpgradeCategory = 'plan' | 'storage'

export function resolveBillingUpgradeCategory(error: unknown): BillingUpgradeCategory | null {
  const code = getRequestErrorCode(error)
  if (code === PLAN_LIMIT_CODE) {
    return 'plan'
  }
  if (code === STORAGE_LIMIT_CODE) {
    return 'storage'
  }

  const status = getRequestStatusCode(error)
  if (status === 402) {
    return 'plan'
  }

  return null
}

export function presentBillingUpgradeModal(category: BillingUpgradeCategory) {
  if (category === 'storage') {
    Modal.present(ManagedStoragePlansModal, {}, { dismissOnOutsideClick: true })
    return
  }
  Modal.present(BillingPlanUpgradeModal, {}, { dismissOnOutsideClick: true })
}

const billingPlanUpgradeKeys = {
  title: 'plan.upgrade-modal.title',
  description: 'plan.upgrade-modal.description',
  actionUpgrade: 'plan.upgrade-modal.action.upgrade',
  actionLater: 'plan.upgrade-modal.action.later',
} as const

export const BillingPlanUpgradeModal: ModalComponent = ({ dismiss }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleUpgrade = () => {
    dismiss?.()
    navigate('/plan')
  }

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-4">
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold leading-none tracking-tight">
          {t(billingPlanUpgradeKeys.title)}
        </DialogTitle>
        <DialogDescription className="text-sm text-text-secondary">
          {t(billingPlanUpgradeKeys.description)}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="mt-1 gap-2">
        <Button type="button" variant="ghost" onClick={dismiss}>
          {t(billingPlanUpgradeKeys.actionLater)}
        </Button>
        <Button type="button" variant="primary" onClick={handleUpgrade}>
          {t(billingPlanUpgradeKeys.actionUpgrade)}
        </Button>
      </DialogFooter>
    </div>
  )
}

BillingPlanUpgradeModal.contentClassName = 'w-[520px] max-w-[92vw]'
