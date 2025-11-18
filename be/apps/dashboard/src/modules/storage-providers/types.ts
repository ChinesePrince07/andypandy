export type StorageProviderType = 's3' | 'github'

export interface StorageProvider {
  id: string
  name: string
  type: StorageProviderType
  config: Record<string, string>
  createdAt?: string
  updatedAt?: string
}

export interface StorageProvidersPayload {
  providers: StorageProvider[]
  activeProviderId: string | null
}

export interface StorageSettingEntry {
  key: string
  value: string
}

export interface StorageProviderFieldDefinition {
  key: string
  labelKey: I18nKeys
  placeholderKey?: I18nKeys
  descriptionKey?: I18nKeys
  helperKey?: I18nKeys
  multiline?: boolean
  sensitive?: boolean
}
