import {
  FormHelperText,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@afilmory/ui'
import { clsxm } from '@afilmory/utils'
import { DynamicIcon } from 'lucide-react/dynamic'
import type { ReactNode } from 'react'
import { Fragment, useState } from 'react'

import type {
  SchemaFormState,
  SchemaFormValue,
  UiFieldComponentDefinition,
  UiFieldNode,
  UiGroupNode,
  UiNode,
  UiSchema,
  UiSlotComponent,
} from './types'

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

export const GlassPanel = ({
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

const SecretFieldInput = <Key extends string>({
  component,
  fieldKey,
  value,
  onChange,
}: {
  component: Extract<UiFieldComponentDefinition<Key>, { type: 'secret' }>
  fieldKey: Key
  value: string
  onChange: (key: Key, value: SchemaFormValue) => void
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

type SlotRenderer<Key extends string> = (
  field: UiFieldNode<Key> & { component: UiSlotComponent<Key> },
  context: SchemaRendererContext<Key>,
  onChange: (key: Key, value: SchemaFormValue) => void,
) => ReactNode

type FieldRendererProps<Key extends string> = {
  field: UiFieldNode<Key>
  value: SchemaFormValue | undefined
  onChange: (key: Key, value: SchemaFormValue) => void
  renderSlot?: SlotRenderer<Key>
  context: SchemaRendererContext<Key>
}

const FieldRenderer = <Key extends string>({
  field,
  value,
  onChange,
  renderSlot,
  context,
}: FieldRendererProps<Key>) => {
  const { component } = field

  if (component.type === 'slot') {
    return renderSlot
      ? renderSlot(
          field as UiFieldNode<Key> & { component: UiSlotComponent<Key> },
          context,
          onChange,
        )
      : null
  }

  if (component.type === 'textarea') {
    const stringValue =
      typeof value === 'string' ? value : value == null ? '' : String(value)
    return (
      <Textarea
        value={stringValue}
        onInput={(event) => onChange(field.key, event.currentTarget.value)}
        placeholder={component.placeholder ?? ''}
        rows={component.minRows ?? 3}
        className="bg-background/60"
      />
    )
  }

  if (component.type === 'select') {
    const stringValue =
      typeof value === 'string' ? value : value == null ? '' : String(value)
    return (
      <Select
        value={stringValue}
        onValueChange={(nextValue) => onChange(field.key, nextValue)}
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
    const stringValue =
      typeof value === 'string' ? value : value == null ? '' : String(value)
    return (
      <SecretFieldInput
        component={component}
        fieldKey={field.key}
        value={stringValue}
        onChange={onChange}
      />
    )
  }

  if (component.type === 'switch') {
    const checked = Boolean(value)
    const label = checked ? component.trueLabel : component.falseLabel
    return (
      <div className="flex items-center gap-2">
        <Switch
          checked={checked}
          onCheckedChange={(next) => onChange(field.key, next)}
        />
        {label ? (
          <span className="text-xs text-text-secondary">{label}</span>
        ) : null}
      </div>
    )
  }

  const stringValue =
    typeof value === 'string' ? value : value == null ? '' : String(value)
  const inputType =
    component.type === 'text' ? (component.inputType ?? 'text') : 'text'

  return (
    <Input
      type={inputType}
      value={stringValue}
      onInput={(event) => onChange(field.key, event.currentTarget.value)}
      placeholder={component.placeholder ?? ''}
      autoComplete={component.autoComplete}
      className="bg-background/60"
    />
  )
}

const renderGroup = <Key extends string>(
  node: UiGroupNode<Key>,
  context: SchemaRendererContext<Key>,
  formState: SchemaFormState<Key>,
  handleChange: (key: Key, value: SchemaFormValue) => void,
  shouldRenderNode?: SchemaFormRendererProps<Key>['shouldRenderNode'],
  renderSlot?: SlotRenderer<Key>,
) => {
  const renderedChildren = node.children
    .map((child) =>
      renderNode(
        child,
        context,
        formState,
        handleChange,
        shouldRenderNode,
        renderSlot,
      ),
    )
    .filter(Boolean)

  if (renderedChildren.length === 0) {
    return null
  }

  return (
    <div
      key={node.id}
      className="rounded-2xl border border-accent/10 bg-accent/2 p-5 backdrop-blur-xl transition-all duration-200"
    >
      <div className="flex items-center gap-2">
        <SchemaIcon name={node.icon} className="text-accent" />
        <h3 className="text-sm font-semibold text-text">{node.title}</h3>
      </div>
      <FieldDescription description={node.description} />

      <div className="mt-4 space-y-4">{renderedChildren}</div>
    </div>
  )
}

const renderField = <Key extends string>(
  field: UiFieldNode<Key>,
  formState: SchemaFormState<Key>,
  handleChange: (key: Key, value: SchemaFormValue) => void,
  renderSlot: SlotRenderer<Key> | undefined,
  context: SchemaRendererContext<Key>,
) => {
  if (field.hidden) {
    return null
  }

  const value = formState[field.key]
  const { isSensitive, helperText, component, icon } = field

  if (component.type === 'switch') {
    const helper = helperText ? (
      <FormHelperText>{helperText}</FormHelperText>
    ) : null

    return (
      <div
        key={field.id}
        className="rounded-xl border border-fill/30 bg-background/40 p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Label className="text-sm font-medium text-text">
              {field.title}
            </Label>
            <FieldDescription description={field.description} />
          </div>
          <FieldRenderer
            field={field}
            value={value}
            onChange={handleChange}
            renderSlot={renderSlot}
            context={context}
          />
        </div>
        {helper}
      </div>
    )
  }

  const showSensitiveHint =
    isSensitive && typeof value === 'string' && value.length === 0

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
        <SchemaIcon name={icon} className="text-text-tertiary" />
      </div>

      <FieldRenderer
        field={field}
        value={value}
        onChange={handleChange}
        renderSlot={renderSlot}
        context={context}
      />

      {showSensitiveHint ? (
        <FormHelperText>出于安全考虑，仅在更新时填写新的值。</FormHelperText>
      ) : null}

      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </div>
  )
}

const renderNode = <Key extends string>(
  node: UiNode<Key>,
  context: SchemaRendererContext<Key>,
  formState: SchemaFormState<Key>,
  handleChange: (key: Key, value: SchemaFormValue) => void,
  shouldRenderNode?: SchemaFormRendererProps<Key>['shouldRenderNode'],
  renderSlot?: SlotRenderer<Key>,
): ReactNode => {
  if (shouldRenderNode && !shouldRenderNode(node, context)) {
    return null
  }

  if (node.type === 'group') {
    return renderGroup(
      node,
      context,
      formState,
      handleChange,
      shouldRenderNode,
      renderSlot,
    )
  }

  if (node.type === 'field') {
    return renderField(node, formState, handleChange, renderSlot, context)
  }

  const renderedChildren = node.children
    .map((child) =>
      renderNode(
        child,
        context,
        formState,
        handleChange,
        shouldRenderNode,
        renderSlot,
      ),
    )
    .filter(Boolean)

  if (renderedChildren.length === 0) {
    return null
  }

  return (
    <Fragment key={node.id}>
      <div className="flex items-center gap-2">
        <SchemaIcon name={node.icon} className="h-5 w-5 text-accent" />
        <h2 className="text-base font-semibold text-text">{node.title}</h2>
      </div>
      <FieldDescription description={node.description} />
      <div className="grid gap-4">{renderedChildren}</div>
    </Fragment>
  )
}

export interface SchemaRendererContext<Key extends string> {
  readonly values: SchemaFormState<Key>
}

export interface SchemaFormRendererProps<Key extends string> {
  schema: UiSchema<Key>
  values: SchemaFormState<Key>
  onChange: (key: Key, value: SchemaFormValue) => void
  shouldRenderNode?: (
    node: UiNode<Key>,
    context: SchemaRendererContext<Key>,
  ) => boolean
  renderSlot?: SlotRenderer<Key>
}

export const SchemaFormRenderer = <Key extends string>({
  schema,
  values,
  onChange,
  shouldRenderNode,
  renderSlot,
}: SchemaFormRendererProps<Key>) => {
  const context: SchemaRendererContext<Key> = { values }

  return (
    <>
      {schema.sections.map((section) => {
        if (shouldRenderNode && !shouldRenderNode(section, context)) {
          return null
        }

        const renderedChildren = section.children
          .map((child) =>
            renderNode(
              child,
              context,
              values,
              onChange,
              shouldRenderNode,
              renderSlot,
            ),
          )
          .filter(Boolean)

        if (renderedChildren.length === 0) {
          return null
        }

        return (
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

              <div className="space-y-4">{renderedChildren}</div>
            </div>
          </GlassPanel>
        )
      })}
    </>
  )
}
