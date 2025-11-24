export const STORAGE_PROVIDERS_SETTING_KEY = 'builder.storage.providers'

export const STORAGE_PROVIDER_SENSITIVE_FIELDS: Record<string, readonly string[]> = {
  s3: ['secretAccessKey'],
  oss: ['secretAccessKey'],
  cos: ['secretAccessKey'],
  github: ['token'],
  b2: ['applicationKey'],
}
