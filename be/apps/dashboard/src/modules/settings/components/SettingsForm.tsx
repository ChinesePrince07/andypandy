/* eslint-disable react-hooks/refs */
import {
  FormHelperText,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@afilmory/ui'
import { clsxm, Spring } from '@afilmory/utils'
import { DynamicIcon } from 'lucide-react/dynamic'
import { m } from 'motion/react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useSettingUiSchemaQuery, useUpdateSettingsMutation } from '../hooks'
import type {
  SettingEntryInput,
  SettingUiSchemaResponse,
  SettingValueState,
  UiFieldComponentDefinition,
  UiFieldNode,
  UiGroupNode,
  UiNode,
  UiSectionNode,
} from '../types'

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

const providerGroupVisibility: Record<string, string> = {
  'builder-storage-s3': 's3',
  'builder-storage-github': 'github',
  'builder-storage-local': 'local',
  'builder-storage-eagle': 'eagle',
}

const collectFieldNodes = (
  nodes: ReadonlyArray<UiNode<string>>,
): UiFieldNode<string>[] => {
  const fields: UiFieldNode<string>[] = []

  for (const node of nodes) {
    if (node.type === 'field') {
      fields.push(node)
      continue
    }

    fields.push(...collectFieldNodes(node.children))
  }

  return fields
}

const buildInitialState = (
  schema: SettingUiSchemaResponse['schema'],
  values: SettingUiSchemaResponse['values'],
): SettingValueState<string> => {
  const state: SettingValueState<string> = {} as SettingValueState<string>
  const fields = collectFieldNodes(schema.sections)

  for (const field of fields) {
    const rawValue = values[field.key]
    state[field.key] = typeof rawValue === 'string' ? rawValue : ''
  }

  return state
}

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

const FieldDescription = ({ description }: { description?: string | null }) => {
  if (!description) {
    return null
  }

  return <p className="mt-1 text-xs text-text-tertiary">{description}</p>
}

const SchemaIcon = ({
  name,
  className,
}: {
  name?: string | null
  className?: string
}) => {
  if (!name) {
    return null
  }

  return (
    <DynamicIcon name={name as any} className={clsxm('h-4 w-4', className)} />
  )
}

const SecretFieldInput = ({
  component,
  fieldKey,
  value,
  onChange,
}: {
  component: Extract<UiFieldComponentDefinition<string>, { type: 'secret' }>
  fieldKey: string
  value: string
  onChange: (key: string, value: string) => void
}) => {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="flex w-full items-center gap-2">
      <Input
        type={revealed ? 'text' : 'password'}
        value={value}
        onInput={(event) => onChange(fieldKey, event.currentTarget.value)}
        placeholder={component.placeholder ?? ''}
        autoComplete={component.autoComplete}
        className="flex-1 bg-background/60"
      />
      {component.revealable ? (
        <button
          type="button"
          onClick={() => setRevealed((prev) => !prev)}
          className="h-9 rounded-lg border border-accent/30 px-3 text-xs font-medium text-accent transition-all duration-200 hover:bg-accent/10"
        >
          {revealed ? '隐藏' : '显示'}
        </button>
      ) : null}
    </div>
  )
}

const FieldRenderer = ({
  field,
  value,
  onChange,
}: {
  field: UiFieldNode<string>
  value: string
  onChange: (key: string, value: string) => void
}) => {
  const { component } = field

  if (component.type === 'slot') {
    // Slot components are handled by a dedicated renderer once implemented.
    return null
  }

  if (component.type === 'textarea') {
    return (
      <Textarea
        value={value}
        onInput={(event) => onChange(field.key, event.currentTarget.value)}
        placeholder={component.placeholder ?? ''}
        rows={component.minRows ?? 3}
        className="bg-background/60"
      />
    )
  }

  if (component.type === 'select') {
    return (
      <Select
        value={value}
        onValueChange={(value) => onChange(field.key, value)}
      >
        <SelectTrigger>
          <SelectValue placeholder={component.placeholder ?? '请选择'} />
        </SelectTrigger>
        <SelectContent>
          {component.options?.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (component.type === 'secret') {
    return (
      <SecretFieldInput
        component={component}
        fieldKey={field.key}
        value={value}
        onChange={onChange}
      />
    )
  }

  const inputType =
    component.type === 'text' ? (component.inputType ?? 'text') : 'text'

  return (
    <Input
      type={inputType}
      value={value}
      onInput={(event) => onChange(field.key, event.currentTarget.value)}
      placeholder={component.placeholder ?? ''}
      autoComplete={component.autoComplete}
      className="bg-background/60"
    />
  )
}

const renderGroup = (
  node: UiGroupNode<string>,
  provider: string,
  formState: SettingValueState<string>,
  handleChange: (key: string, value: string) => void,
) => {
  const expectedProvider = providerGroupVisibility[node.id]
  if (expectedProvider && expectedProvider !== provider) {
    return null
  }

  return (
    <div
      key={node.id}
      className="rounded-2xl border border-accent/10 bg-accent/[0.02] p-5 backdrop-blur-xl transition-all duration-200"
    >
      <div className="flex items-center gap-2">
        <SchemaIcon name={node.icon} className="text-accent" />
        <h3 className="text-sm font-semibold text-text">{node.title}</h3>
      </div>
      <FieldDescription description={node.description} />

      <div className="mt-4 space-y-4">
        {node.children.map((child) =>
          renderNode(child, provider, formState, handleChange),
        )}
      </div>
    </div>
  )
}

const renderField = (
  field: UiFieldNode<string>,
  formState: SettingValueState<string>,
  handleChange: (key: string, value: string) => void,
) => {
  const value = formState[field.key] ?? ''
  const { isSensitive } = field
  const showSensitiveHint = isSensitive && value.length === 0

  return (
    <div
      key={field.id}
      className="space-y-2 rounded-xl border border-fill-tertiary/40 bg-background/30 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="text-sm font-medium text-text">{field.title}</Label>
          <FieldDescription description={field.description} />
        </div>
        <SchemaIcon name={field.icon} className="text-text-tertiary" />
      </div>

      <FieldRenderer field={field} value={value} onChange={handleChange} />

      {showSensitiveHint ? (
        <FormHelperText>出于安全考虑，仅在更新时填写新的值。</FormHelperText>
      ) : null}

      <FormHelperText>{field.helperText ?? undefined}</FormHelperText>
    </div>
  )
}

const renderNode = (
  node: UiNode<string>,
  provider: string,
  formState: SettingValueState<string>,
  handleChange: (key: string, value: string) => void,
): ReactNode => {
  if (node.type === 'group') {
    return renderGroup(node, provider, formState, handleChange)
  }

  if (node.type === 'field') {
    return renderField(node, formState, handleChange)
  }

  return (
    <div key={node.id} className="space-y-4">
      <div className="flex items-center gap-2">
        <SchemaIcon name={node.icon} className="h-5 w-5 text-accent" />
        <h2 className="text-base font-semibold text-text">{node.title}</h2>
      </div>
      <FieldDescription description={node.description} />
      <div className="grid gap-4">
        {node.children.map((child) =>
          renderNode(child, provider, formState, handleChange),
        )}
      </div>
    </div>
  )
}

export const SettingsForm = () => {
  const { data, isLoading, isError, error } = useSettingUiSchemaQuery()
  const updateSettingsMutation = useUpdateSettingsMutation()
  const [formState, setFormState] = useState<SettingValueState<string>>(
    {} as SettingValueState<string>,
  )
  const initialStateRef = useRef<SettingValueState<string>>(
    {} as SettingValueState<string>,
  )

  useEffect(() => {
    if (!data) {
      return
    }

    const initialValues = buildInitialState(data.schema, data.values)
    setFormState(initialValues)
    initialStateRef.current = initialValues
  }, [data])

  const providerValue = formState['builder.storage.provider'] ?? ''

  const changedEntries = useMemo<SettingEntryInput[]>(() => {
    const entries: SettingEntryInput[] = []

    for (const [key, value] of Object.entries(formState)) {
      if (
        (initialStateRef.current as SettingValueState<string>)[key] !== value
      ) {
        entries.push({ key, value })
      }
    }

    return entries
  }, [formState])

  const handleChange = (key: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    if (changedEntries.length === 0 || updateSettingsMutation.isPending) {
      return
    }

    updateSettingsMutation.mutate(changedEntries)
  }

  const mutationErrorMessage =
    updateSettingsMutation.isError && updateSettingsMutation.error
      ? updateSettingsMutation.error instanceof Error
        ? updateSettingsMutation.error.message
        : '未知错误'
      : null

  if (isLoading) {
    return (
      <GlassPanel className="p-6">
        <div className="space-y-4">
          <div className="h-5 w-1/2 animate-pulse rounded-full bg-fill/40" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-xl bg-fill/30"
              />
            ))}
          </div>
        </div>
      </GlassPanel>
    )
  }

  if (isError) {
    return (
      <GlassPanel className="p-6">
        <div className="flex items-center gap-3 text-sm text-red">
          <i className="i-mingcute-close-circle-fill text-lg" />
          <span>
            无法加载设置：{error instanceof Error ? error.message : '未知错误'}
          </span>
        </div>
      </GlassPanel>
    )
  }

  if (!data) {
    return null
    // Should never reach here since loading and error states are handled.
  }

  const { schema } = data

  return (
    <m.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={Spring.presets.smooth}
      className="space-y-6"
    >
      {schema.sections.map((section: UiSectionNode<string>) => (
        <GlassPanel key={section.id} className="p-6">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <SchemaIcon
                  name={section.icon}
                  className="h-5 w-5 text-accent"
                />
                <h2 className="text-lg font-semibold text-text">
                  {section.title}
                </h2>
              </div>
              <FieldDescription description={section.description} />
            </div>

            <div className="space-y-4">
              {section.children.map((child) =>
                renderNode(child, providerValue, formState, handleChange),
              )}
            </div>
          </div>
        </GlassPanel>
      ))}

      <div className="flex items-center justify-end gap-3">
        <div className="text-xs text-text-tertiary">
          {mutationErrorMessage
            ? `保存失败：${mutationErrorMessage}`
            : updateSettingsMutation.isSuccess && changedEntries.length === 0
              ? '保存成功，设置已同步'
              : changedEntries.length > 0
                ? `有 ${changedEntries.length} 项设置待保存`
                : '所有设置已同步'}
        </div>
        <button
          type="submit"
          disabled={
            changedEntries.length === 0 || updateSettingsMutation.isPending
          }
          className={clsxm(
            'rounded-xl border border-accent/40 bg-accent px-4 py-2 text-sm font-semibold text-white transition-all duration-200',
            'hover:bg-accent/90 disabled:cursor-not-allowed disabled:border-accent/20 disabled:bg-accent/30 disabled:text-white/60',
          )}
        >
          {updateSettingsMutation.isPending ? '保存中…' : '保存修改'}
        </button>
      </div>
    </m.form>
  )
}
