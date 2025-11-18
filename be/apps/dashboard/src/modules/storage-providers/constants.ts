import type { StorageProviderFieldDefinition, StorageProviderType } from './types'

export const STORAGE_SETTING_KEYS = {
  providers: 'builder.storage.providers',
  activeProvider: 'builder.storage.activeProvider',
} as const

export const STORAGE_PROVIDER_TYPES: readonly StorageProviderType[] = ['s3', 'github']

export const STORAGE_PROVIDER_TYPE_OPTIONS: ReadonlyArray<{
  value: StorageProviderType
  labelKey: I18nKeys
}> = [
  { value: 's3', labelKey: 'storage.providers.types.s3' },
  { value: 'github', labelKey: 'storage.providers.types.github' },
]

export const storageProvidersI18nKeys = {
  blocker: {
    title: 'storage.providers.blocker.title',
    description: 'storage.providers.blocker.description',
    confirm: 'storage.providers.blocker.confirm',
    cancel: 'storage.providers.blocker.cancel',
  },
  actions: {
    add: 'storage.providers.actions.add',
    save: 'storage.providers.actions.save',
    saving: 'storage.providers.actions.saving',
    cancel: 'storage.providers.actions.cancel',
    create: 'storage.providers.actions.create',
  },
  prompt: {
    title: 'storage.providers.prompt.sync.title',
    description: 'storage.providers.prompt.sync.description',
    confirm: 'storage.providers.prompt.sync.confirm',
    cancel: 'storage.providers.prompt.sync.cancel',
  },
  status: {
    error: 'storage.providers.status.error',
    saved: 'storage.providers.status.saved',
    dirty: 'storage.providers.status.dirty',
    summary: 'storage.providers.status.summary',
  },
  empty: {
    title: 'storage.providers.empty.title',
    description: 'storage.providers.empty.description',
    action: 'storage.providers.empty.action',
  },
  errors: {
    load: 'storage.providers.error.load',
  },
  security: {
    title: 'storage.providers.security.title',
    description: 'storage.providers.security.description',
    helper: 'storage.providers.security.helper',
  },
  modal: {
    createTitle: 'storage.providers.modal.create.title',
    editTitle: 'storage.providers.modal.edit.title',
    createDescription: 'storage.providers.modal.create.description',
    editDescription: 'storage.providers.modal.edit.description',
    sections: {
      basic: 'storage.providers.modal.sections.basic',
      connection: 'storage.providers.modal.sections.connection',
    },
    fields: {
      nameLabel: 'storage.providers.modal.fields.name.label',
      namePlaceholder: 'storage.providers.modal.fields.name.placeholder',
      typeLabel: 'storage.providers.modal.fields.type.label',
      typePlaceholder: 'storage.providers.modal.fields.type.placeholder',
    },
  },
  card: {
    active: 'storage.providers.card.active',
    makeActive: 'storage.providers.card.make-active',
    makeInactive: 'storage.providers.card.make-inactive',
    edit: 'storage.providers.card.edit',
    notConfigured: 'storage.providers.card.preview.not-configured',
    fallback: 'storage.providers.card.preview.fallback',
    untitled: 'storage.providers.card.untitled',
  },
  types: {
    s3: 'storage.providers.types.s3',
    github: 'storage.providers.types.github',
    local: 'storage.providers.types.local',
    minio: 'storage.providers.types.minio',
    eagle: 'storage.providers.types.eagle',
  },
} as const satisfies {
  blocker: {
    title: I18nKeys
    description: I18nKeys
    confirm: I18nKeys
    cancel: I18nKeys
  }
  actions: {
    add: I18nKeys
    save: I18nKeys
    saving: I18nKeys
    cancel: I18nKeys
    create: I18nKeys
  }
  prompt: {
    title: I18nKeys
    description: I18nKeys
    confirm: I18nKeys
    cancel: I18nKeys
  }
  status: {
    error: I18nKeys
    saved: I18nKeys
    dirty: I18nKeys
    summary: I18nKeys
  }
  empty: {
    title: I18nKeys
    description: I18nKeys
    action: I18nKeys
  }
  errors: {
    load: I18nKeys
  }
  security: {
    title: I18nKeys
    description: I18nKeys
    helper: I18nKeys
  }
  modal: {
    createTitle: I18nKeys
    editTitle: I18nKeys
    createDescription: I18nKeys
    editDescription: I18nKeys
    sections: {
      basic: I18nKeys
      connection: I18nKeys
    }
    fields: {
      nameLabel: I18nKeys
      namePlaceholder: I18nKeys
      typeLabel: I18nKeys
      typePlaceholder: I18nKeys
    }
  }
  card: {
    active: I18nKeys
    makeActive: I18nKeys
    makeInactive: I18nKeys
    edit: I18nKeys
    notConfigured: I18nKeys
    fallback: I18nKeys
    untitled: I18nKeys
  }
  types: Record<'s3' | 'github' | 'local' | 'minio' | 'eagle', I18nKeys>
}

export const STORAGE_PROVIDER_FIELD_DEFINITIONS: Record<
  StorageProviderType,
  readonly StorageProviderFieldDefinition[]
> = {
  s3: [
    {
      key: 'bucket',
      labelKey: 'storage.providers.fields.s3.bucket.label',
      placeholderKey: 'storage.providers.fields.s3.bucket.placeholder',
      descriptionKey: 'storage.providers.fields.s3.bucket.description',
    },
    {
      key: 'region',
      labelKey: 'storage.providers.fields.s3.region.label',
      placeholderKey: 'storage.providers.fields.s3.region.placeholder',
      descriptionKey: 'storage.providers.fields.s3.region.description',
    },
    {
      key: 'endpoint',
      labelKey: 'storage.providers.fields.s3.endpoint.label',
      placeholderKey: 'storage.providers.fields.s3.endpoint.placeholder',
      descriptionKey: 'storage.providers.fields.s3.endpoint.description',
      helperKey: 'storage.providers.fields.s3.endpoint.helper',
    },
    {
      key: 'accessKeyId',
      labelKey: 'storage.providers.fields.s3.access-key.label',
      placeholderKey: 'storage.providers.fields.s3.access-key.placeholder',
    },
    {
      key: 'secretAccessKey',
      labelKey: 'storage.providers.fields.s3.secret-key.label',
      placeholderKey: 'storage.providers.fields.s3.secret-key.placeholder',
      sensitive: true,
    },
    {
      key: 'prefix',
      labelKey: 'storage.providers.fields.s3.prefix.label',
      placeholderKey: 'storage.providers.fields.s3.prefix.placeholder',
      descriptionKey: 'storage.providers.fields.s3.prefix.description',
    },
    {
      key: 'customDomain',
      labelKey: 'storage.providers.fields.s3.custom-domain.label',
      placeholderKey: 'storage.providers.fields.s3.custom-domain.placeholder',
      descriptionKey: 'storage.providers.fields.s3.custom-domain.description',
    },
    {
      key: 'excludeRegex',
      labelKey: 'storage.providers.fields.s3.exclude-regex.label',
      placeholderKey: 'storage.providers.fields.s3.exclude-regex.placeholder',
      descriptionKey: 'storage.providers.fields.s3.exclude-regex.description',
      multiline: true,
      helperKey: 'storage.providers.fields.s3.exclude-regex.helper',
    },
    {
      key: 'maxFileLimit',
      labelKey: 'storage.providers.fields.s3.max-files.label',
      placeholderKey: 'storage.providers.fields.s3.max-files.placeholder',
      descriptionKey: 'storage.providers.fields.s3.max-files.description',
    },
  ],
  github: [
    {
      key: 'owner',
      labelKey: 'storage.providers.fields.github.owner.label',
      placeholderKey: 'storage.providers.fields.github.owner.placeholder',
      descriptionKey: 'storage.providers.fields.github.owner.description',
    },
    {
      key: 'repo',
      labelKey: 'storage.providers.fields.github.repo.label',
      placeholderKey: 'storage.providers.fields.github.repo.placeholder',
      descriptionKey: 'storage.providers.fields.github.repo.description',
    },
    {
      key: 'branch',
      labelKey: 'storage.providers.fields.github.branch.label',
      placeholderKey: 'storage.providers.fields.github.branch.placeholder',
      descriptionKey: 'storage.providers.fields.github.branch.description',
      helperKey: 'storage.providers.fields.github.branch.helper',
    },
    {
      key: 'token',
      labelKey: 'storage.providers.fields.github.token.label',
      placeholderKey: 'storage.providers.fields.github.token.placeholder',
      descriptionKey: 'storage.providers.fields.github.token.description',
      sensitive: true,
    },
    {
      key: 'path',
      labelKey: 'storage.providers.fields.github.path.label',
      placeholderKey: 'storage.providers.fields.github.path.placeholder',
      descriptionKey: 'storage.providers.fields.github.path.description',
    },
    {
      key: 'useRawUrl',
      labelKey: 'storage.providers.fields.github.use-raw.label',
      placeholderKey: 'storage.providers.fields.github.use-raw.placeholder',
      descriptionKey: 'storage.providers.fields.github.use-raw.description',
      helperKey: 'storage.providers.fields.github.use-raw.helper',
    },
  ],
}
