import { FormHelperText, Input, Label, Textarea } from '@afilmory/ui'
import { clsxm } from '@afilmory/utils'
import { DynamicIcon } from 'lucide-react/dynamic'
import { m } from 'motion/react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

import {
  STORAGE_PROVIDER_FIELD_DEFINITIONS,
  STORAGE_PROVIDER_TYPE_OPTIONS,
} from '../constants'
import { useStorageProvidersQuery, useUpdateStorageProvidersMutation } from '../hooks'
import type { StorageProvider, StorageProviderType } from '../types'
import {
  createEmptyProvider,
  getDefaultConfigForType,
  reorderProvidersByActive,
} from '../utils'

const glassCardStyles = {
  backgroundImage:
    'linear-gradient(to bottom right, color-mix(in srgb, var(--color-background) 98%, transparent), color-mix(in srgb, var(--color-background) 95%, transparent))',
  boxShadow:
    '0 8px 32px color-mix(in srgb, var(--color-accent) 8%, transparent), 0 4px 16px color-mix(in srgb, var(--color-accent) 6%, transparent), 0 2px 8px rgba(0, 0, 0, 0.08)',
} as const

const glassGlowStyles = {
  background:
    'linear-gradient(to bottom right, color-mix(in srgb, var(--color-accent) 5%, transparent), transparent, color-mix(in srgb, var(--color-accent) 5%, transparent))',
} as const

const typeLabelMap = new Map(
  STORAGE_PROVIDER_TYPE_OPTIONS.map((option) => [option.value, option.label]),
)

const GlassPanel = ({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) => (
  <div
    className={clsxm(
      'group relative overflow-hidden rounded-2xl border border-accent/20 backdrop-blur-2xl',
      className,
    )}
    style={glassCardStyles}
  >
    <div
      className="pointer-events-none absolute inset-0 rounded-2xl opacity-60"
      style={glassGlowStyles}
    />
    <div className="relative">{children}</div>
  </div>
)

const ProviderBadge = ({ type }: { type: StorageProviderType }) => {
  const label = typeLabelMap.get(type) ?? type
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
      <DynamicIcon name="database" className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

export const StorageProvidersManager = () => {
  const { data, isLoading, isError, error } = useStorageProvidersQuery()
  const updateMutation = useUpdateStorageProvidersMutation()

  const [providers, setProviders] = useState<StorageProvider[]>([])
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null)
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    if (!data) {
      return
    }

    const initialProviders = data.providers
    const activeId =
      data.activeProviderId ??
      (initialProviders.length > 0 ? initialProviders[0].id : null)
    setProviders(initialProviders)
    setActiveProviderId(activeId)
    setSelectedProviderId(activeId ?? initialProviders[0]?.id ?? null)
    setIsDirty(false)
  }, [data])

  const orderedProviders = useMemo(
    () => reorderProvidersByActive(providers, activeProviderId),
    [providers, activeProviderId],
  )

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedProviderId) ?? null,
    [providers, selectedProviderId],
  )

  const handleSelectProvider = (providerId: string) => {
    setSelectedProviderId(providerId)
  }

  const markDirty = () => setIsDirty(true)

  const handleAddProvider = () => {
    const newProvider = createEmptyProvider('s3')
    setProviders((prev) => [...prev, newProvider])
    setActiveProviderId((prev) => prev ?? newProvider.id)
    setSelectedProviderId(newProvider.id)
    markDirty()
  }

  const handleDeleteProvider = (providerId: string) => {
    setProviders((prev) => {
      const next = prev.filter((provider) => provider.id !== providerId)
      const nextActive = next.some((provider) => provider.id === activeProviderId)
        ? activeProviderId
        : next[0]?.id ?? null
      setActiveProviderId(nextActive)
      setSelectedProviderId((currentSelected) => {
        if (currentSelected && next.some((provider) => provider.id === currentSelected)) {
          return currentSelected
        }
        return nextActive
      })
      return next
    })
    markDirty()
  }

  const updateProvider = (
    providerId: string,
    updater: (provider: StorageProvider) => StorageProvider,
  ) => {
    setProviders((prev) =>
      prev.map((provider) =>
        provider.id === providerId
          ? updater({
              ...provider,
              updatedAt: new Date().toISOString(),
            })
          : provider,
      ),
    )
    markDirty()
  }

  const handleUpdateName = (providerId: string, name: string) => {
    updateProvider(providerId, (provider) => ({
      ...provider,
      name,
    }))
  }

  const handleUpdateType = (providerId: string, nextType: StorageProviderType) => {
    updateProvider(providerId, (provider) => {
      if (provider.type === nextType) {
        return provider
      }

      const nextConfigFields = STORAGE_PROVIDER_FIELD_DEFINITIONS[nextType]
      const preserved = nextConfigFields.reduce<Record<string, string>>(
        (acc, field) => {
          acc[field.key] = provider.config[field.key] ?? ''
          return acc
        },
        {},
      )

      return {
        ...provider,
        type: nextType,
        config: {
          ...getDefaultConfigForType(nextType),
          ...preserved,
        },
      }
    })
  }

  const handleConfigChange = (
    providerId: string,
    key: string,
    value: string,
  ) => {
    updateProvider(providerId, (provider) => ({
      ...provider,
      config: {
        ...provider.config,
        [key]: value,
      },
    }))
  }

  const handleSetActive = (providerId: string) => {
    setActiveProviderId(providerId)
    markDirty()
  }

  const handleSave = () => {
    const resolvedActiveId =
      activeProviderId && providers.some((provider) => provider.id === activeProviderId)
        ? activeProviderId
        : providers[0]?.id ?? null

    updateMutation.mutate(
      {
        providers,
        activeProviderId: resolvedActiveId,
      },
      {
        onSuccess: () => {
          setIsDirty(false)
        },
      },
    )
  }

  if (isLoading && !data) {
    return (
      <GlassPanel className="p-6">
        <div className="space-y-4">
          <div className="h-5 w-1/3 animate-pulse rounded-full bg-fill/40" />
          <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
            <div className="h-40 animate-pulse rounded-xl bg-fill/20" />
            <div className="h-40 animate-pulse rounded-xl bg-fill/20" />
          </div>
        </div>
      </GlassPanel>
    )
  }

  if (isError) {
    return (
      <GlassPanel className="p-6">
        <div className="flex items-center gap-3 text-sm text-red">
          <DynamicIcon name="alert-triangle" className="h-5 w-5" />
          <span>
            无法加载存储配置：
            {error instanceof Error ? error.message : '未知错误'}
          </span>
        </div>
      </GlassPanel>
    )
  }

  const mutationErrorMessage =
    updateMutation.isError && updateMutation.error
      ? updateMutation.error instanceof Error
        ? updateMutation.error.message
        : '未知错误'
      : null

  const hasProviders = providers.length > 0
  const selectedFields =
    selectedProvider != null
      ? STORAGE_PROVIDER_FIELD_DEFINITIONS[selectedProvider.type]
      : []

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <GlassPanel className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text">存储提供商</h2>
            <p className="text-xs text-text-tertiary">
              可以配置多个提供商并快速切换。
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddProvider}
            className="flex items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-all duration-200 hover:bg-accent/20"
          >
            <DynamicIcon name="plus" className="h-3.5 w-3.5" />
            新增
          </button>
        </div>

        {hasProviders ? (
          <div className="mt-4 space-y-2">
            {orderedProviders.map((provider) => {
              const isSelected = provider.id === selectedProviderId
              const isActive = provider.id === activeProviderId
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handleSelectProvider(provider.id)}
                  className={clsxm(
                    'w-full rounded-xl border px-3 py-2 text-left transition-all duration-200',
                    'flex flex-col gap-1.5',
                    isSelected
                      ? 'border-accent/40 bg-accent/15 text-accent'
                      : 'border-fill-tertiary bg-background/60 hover:border-accent/20 hover:bg-accent/10',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {provider.name || '未命名存储'}
                    </span>
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-white">
                        <DynamicIcon name="check-circle" className="h-3.5 w-3.5" />
                        Active
                      </span>
                    ) : null}
                  </div>
                  <ProviderBadge type={provider.type} />
                </button>
              )
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-accent/30 bg-accent/5 p-4 text-center text-xs text-text-tertiary">
            暂无存储提供商，点击「新增」开始配置。
          </div>
        )}
      </GlassPanel>

      <GlassPanel className="p-6">
        {selectedProvider ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <DynamicIcon name="hard-drive" className="h-5 w-5 text-accent" />
                  <h2 className="text-base font-semibold text-text">
                    {selectedProvider.name || '未命名存储'}
                  </h2>
                </div>
                <p className="text-xs text-text-tertiary">
                  更新提供商的连接信息并保存，即可让 Builder 使用最新配置。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSetActive(selectedProvider.id)}
                  disabled={selectedProvider.id === activeProviderId}
                  className={clsxm(
                    'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200',
                    selectedProvider.id === activeProviderId
                      ? 'border-accent/20 bg-accent/10 text-accent/60 cursor-not-allowed'
                      : 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20',
                  )}
                >
                  设为 Active
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteProvider(selectedProvider.id)}
                  className="rounded-lg border border-red/40 bg-red/10 px-3 py-1.5 text-xs font-medium text-red transition-all duration-200 hover:bg-red/15"
                >
                  删除
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-text">显示名称</Label>
                <Input
                  value={selectedProvider.name}
                  onInput={(event) =>
                    handleUpdateName(selectedProvider.id, event.currentTarget.value)
                  }
                  placeholder="例如：生产环境 S3"
                  className="bg-background/60"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-text">类型</Label>
                <select
                  value={selectedProvider.type}
                  onChange={(event) =>
                    handleUpdateType(
                      selectedProvider.id,
                      event.currentTarget.value as StorageProviderType,
                    )
                  }
                  className="h-10 w-full rounded-lg border border-fill-tertiary bg-background/70 px-3 text-sm text-text transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/40"
                >
                  {STORAGE_PROVIDER_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text">连接配置</h3>
              <div className="space-y-4">
                {selectedFields.map((field) => {
                  const value = selectedProvider.config[field.key] ?? ''
                  const handler = (nextValue: string) =>
                    handleConfigChange(selectedProvider.id, field.key, nextValue)

                  return (
                    <div
                      key={field.key}
                      className="space-y-2 rounded-xl border border-fill-tertiary/40 bg-background/30 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Label className="text-xs font-semibold text-text">
                            {field.label}
                          </Label>
                          <p className="text-xs text-text-tertiary">
                            {field.description}
                          </p>
                        </div>
                      </div>

                      {field.multiline ? (
                        <Textarea
                          value={value}
                          onInput={(event) => handler(event.currentTarget.value)}
                          placeholder={field.placeholder}
                          rows={field.multiline ? 3 : 2}
                          className="bg-background/60"
                        />
                      ) : (
                        <Input
                          type={field.sensitive ? 'password' : 'text'}
                          value={value}
                          onInput={(event) => handler(event.currentTarget.value)}
                          placeholder={field.placeholder}
                          className="bg-background/60"
                          autoComplete="off"
                        />
                      )}

                      <FormHelperText>{field.helper}</FormHelperText>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-accent/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-text-tertiary">
                {mutationErrorMessage
                  ? `保存失败：${mutationErrorMessage}`
                  : updateMutation.isSuccess && !isDirty
                    ? '保存成功，配置已同步'
                    : isDirty
                      ? '有未保存的更改'
                      : '暂无更改'}
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  !isDirty || updateMutation.isPending || providers.length === 0
                }
                className={clsxm(
                  'rounded-xl border border-accent/40 bg-accent px-4 py-2 text-sm font-semibold text-white transition-all duration-200',
                  'hover:bg-accent/90 disabled:cursor-not-allowed disabled:border-accent/20 disabled:bg-accent/30 disabled:text-white/60',
                )}
              >
                {updateMutation.isPending ? '保存中…' : '保存配置'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <DynamicIcon name="hard-drive" className="h-8 w-8 text-accent/60" />
            <div className="space-y-1">
              <div className="text-sm font-medium text-text">
                选择或创建一个提供商
              </div>
              <p className="text-xs text-text-tertiary">
                从左侧列表中选择一个提供商进行配置，或新建一个提供商。
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddProvider}
              className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-all duration-200 hover:bg-accent/20"
            >
              立即创建
            </button>
          </div>
        )}
      </GlassPanel>
    </div>
  )
}
