import { Button, Modal, Prompt } from '@afilmory/ui'
import { Spring } from '@afilmory/utils'
import { DynamicIcon } from 'lucide-react/dynamic'
import { m } from 'motion/react'
import { startTransition, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useSetPhotoSyncAutoRun } from '~/atoms/photo-sync'
import { LinearBorderPanel } from '~/components/common/GlassPanel'
import { MainPageLayout, useMainPageLayout } from '~/components/layouts/MainPageLayout'
import { useBlock } from '~/hooks/useBlock'

import { storageProvidersI18nKeys } from '../constants'
import { useStorageProvidersQuery, useUpdateStorageProvidersMutation } from '../hooks'
import type { StorageProvider } from '../types'
import { createEmptyProvider, reorderProvidersByActive } from '../utils'
import { ProviderCard } from './ProviderCard'
import { ProviderEditModal } from './ProviderEditModal'

export function StorageProvidersManager() {
  const { data, isLoading, isError, error } = useStorageProvidersQuery()
  const updateMutation = useUpdateStorageProvidersMutation()
  const { setHeaderActionState } = useMainPageLayout()
  const navigate = useNavigate()
  const setPhotoSyncAutoRun = useSetPhotoSyncAutoRun()
  const { t } = useTranslation()

  const [providers, setProviders] = useState<StorageProvider[]>([])
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const initialProviderStateRef = useRef<boolean | null>(null)
  const hasShownSyncPromptRef = useRef(false)

  useBlock({
    when: isDirty,
    title: t(storageProvidersI18nKeys.blocker.title),
    description: t(storageProvidersI18nKeys.blocker.description),
    confirmText: t(storageProvidersI18nKeys.blocker.confirm),
    cancelText: t(storageProvidersI18nKeys.blocker.cancel),
  })

  useEffect(() => {
    if (!data) {
      return
    }

    const initialProviders = data.providers
    const activeId = data.activeProviderId ?? (initialProviders.length > 0 ? initialProviders[0].id : null)

    startTransition(() => {
      setProviders(initialProviders)
      setActiveProviderId(activeId)
      setIsDirty(false)
    })
  }, [data])

  useEffect(() => {
    if (!data) {
      return
    }
    if (initialProviderStateRef.current === null) {
      initialProviderStateRef.current = data.providers.length > 0
    }
  }, [data])

  const orderedProviders = reorderProvidersByActive(providers, activeProviderId)

  const markDirty = () => setIsDirty(true)

  const handleEditProvider = (provider: StorageProvider | null) => {
    Modal.present(
      ProviderEditModal,
      {
        provider,
        activeProviderId,
        onSave: handleSaveProvider,
        onSetActive: handleSetActive,
      },
      {
        dismissOnOutsideClick: false,
      },
    )
  }

  const handleAddProvider = () => {
    const newProvider = createEmptyProvider('s3')
    handleEditProvider(newProvider)
  }

  const handleSaveProvider = (updatedProvider: StorageProvider) => {
    setProviders((prev) => {
      const exists = prev.some((p) => p.id === updatedProvider.id)
      if (exists) {
        return prev.map((p) => (p.id === updatedProvider.id ? updatedProvider : p))
      }
      // New provider
      const result = [...prev, updatedProvider]
      // Set as active ONLY if it's the very first provider
      if (prev.length === 0) {
        setActiveProviderId(updatedProvider.id)
      }
      return result
    })
    markDirty()
  }

  const handleSetActive = (providerId: string) => {
    setActiveProviderId(providerId)
    markDirty()
  }

  const handleSave = () => {
    const resolvedActiveId =
      activeProviderId && providers.some((provider) => provider.id === activeProviderId) ? activeProviderId : null

    updateMutation.mutate(
      {
        providers,
        activeProviderId: resolvedActiveId,
      },
      {
        onSuccess: () => {
          setIsDirty(false)
          const hadProvidersInitially =
            initialProviderStateRef.current ?? ((data?.providers.length ?? 0) > 0 ? true : false)
          if (!hadProvidersInitially && providers.length > 0 && !hasShownSyncPromptRef.current) {
            initialProviderStateRef.current = true
            hasShownSyncPromptRef.current = true
            Prompt.prompt({
              title: t(storageProvidersI18nKeys.prompt.title),
              description: t(storageProvidersI18nKeys.prompt.description),
              onConfirmText: t(storageProvidersI18nKeys.prompt.confirm),
              onCancelText: t(storageProvidersI18nKeys.prompt.cancel),
              onConfirm: () => {
                setPhotoSyncAutoRun('apply')
                navigate('/photos/sync')
              },
            })
          }
        },
      },
    )
  }

  const disableSave = isLoading || isError || !isDirty || updateMutation.isPending || providers.length === 0
  useEffect(() => {
    setHeaderActionState((prev) => {
      const nextState = {
        disabled: disableSave,
        loading: updateMutation.isPending,
      }
      return prev.disabled === nextState.disabled && prev.loading === nextState.loading ? prev : nextState
    })

    return () => {
      setHeaderActionState({ disabled: false, loading: false })
    }
  }, [disableSave, setHeaderActionState, updateMutation.isPending])

  const headerActionPortal = (
    <MainPageLayout.Actions>
      <Button type="button" onClick={handleAddProvider} size="sm" variant="secondary">
        {t(storageProvidersI18nKeys.actions.add)}
      </Button>
      <Button
        type="button"
        onClick={handleSave}
        disabled={disableSave}
        isLoading={updateMutation.isPending}
        loadingText={t(storageProvidersI18nKeys.actions.saving)}
        variant="primary"
        size="sm"
      >
        {t(storageProvidersI18nKeys.actions.save)}
      </Button>
    </MainPageLayout.Actions>
  )

  if (isLoading && !data) {
    return (
      <>
        {headerActionPortal}
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={Spring.presets.smooth}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-background-tertiary h-[180px] animate-pulse rounded" />
          ))}
        </m.div>
      </>
    )
  }

  if (isError) {
    return (
      <>
        {headerActionPortal}
        <div className="bg-background-tertiary text-red flex items-center justify-center gap-3 rounded p-8 text-sm">
          <span>
            {t(storageProvidersI18nKeys.errors.load)}：
            <span>{error instanceof Error ? error.message : t('common.unknown-error')}</span>
          </span>
        </div>
      </>
    )
  }

  const hasProviders = providers.length > 0

  return (
    <>
      {headerActionPortal}

      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={Spring.presets.smooth}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {orderedProviders.map((provider, index) => (
          <m.div
            key={provider.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...Spring.presets.smooth, delay: index * 0.05 }}
          >
            <ProviderCard
              provider={provider}
              isActive={provider.id === activeProviderId}
              onEdit={() => handleEditProvider(provider)}
              onToggleActive={() => {
                setActiveProviderId((prev) => (prev === provider.id ? null : provider.id))
                markDirty()
              }}
            />
          </m.div>
        ))}

        {!hasProviders && (
          <m.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={Spring.presets.smooth}
            className="col-span-full"
          >
            <div className="bg-background-tertiary border-fill-tertiary flex flex-col items-center justify-center gap-3 rounded-lg border p-8 text-center">
              <div className="space-y-1">
                <p className="text-text-secondary text-sm">{t(storageProvidersI18nKeys.empty.title)}</p>
                <p className="text-text-tertiary text-xs">{t(storageProvidersI18nKeys.empty.description)}</p>
              </div>
              <Button type="button" size="sm" variant="primary" onClick={handleAddProvider}>
                {t(storageProvidersI18nKeys.empty.action)}
              </Button>
            </div>
          </m.div>
        )}
      </m.div>

      {/* Status Message */}
      {hasProviders && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...Spring.presets.smooth, delay: 0.2 }}
          className="mt-4 text-center"
        >
          <p className="text-text-tertiary text-xs">
            <span>{getStatusMessage()}</span>
          </p>
        </m.div>
      )}

      {/* Security Notice */}
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={Spring.presets.smooth}
        className="mb-6"
      >
        <LinearBorderPanel className="bg-background-secondary/40 p-4 sm:p-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="shrink-0">
              <div className="bg-accent/10 inline-flex h-8 w-8 items-center justify-center rounded-lg sm:h-10 sm:w-10">
                <DynamicIcon name="shield-check" className="h-4 w-4 text-accent sm:h-5 sm:w-5" />
              </div>
            </div>
            <div className="flex-1 space-y-1.5 sm:space-y-2">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-text text-sm font-semibold sm:text-base">
                  {t(storageProvidersI18nKeys.security.title)}
                </span>
              </div>
              <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
                {t(storageProvidersI18nKeys.security.description, { algorithm: 'AES-256-GCM' })}
              </p>
              <p className="text-text-tertiary text-[11px] sm:text-xs">
                {t(storageProvidersI18nKeys.security.helper, { algorithm: 'AES-256-GCM' })}
              </p>
            </div>
          </div>
        </LinearBorderPanel>
      </m.div>
    </>
  )

  function getStatusMessage() {
    if (updateMutation.isError && updateMutation.error) {
      const reason = updateMutation.error instanceof Error ? updateMutation.error.message : t('common.unknown-error')
      return t(storageProvidersI18nKeys.status.error, { reason })
    }
    if (updateMutation.isSuccess && !isDirty) {
      return t(storageProvidersI18nKeys.status.saved)
    }
    if (isDirty) {
      return t(storageProvidersI18nKeys.status.dirty, { total: providers.length })
    }
    const activeName =
      orderedProviders.find((p) => p.id === activeProviderId)?.name || t(storageProvidersI18nKeys.card.untitled)
    return t(storageProvidersI18nKeys.status.summary, {
      total: providers.length,
      active: activeName,
    })
  }
}
