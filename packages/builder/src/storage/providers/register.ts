import type { StorageProviderFactory } from '../factory.js'
import { StorageFactory } from '../factory.js'
import type {
  B2Config,
  EagleConfig,
  GitHubConfig,
  LocalConfig,
  S3Config,
  StorageProviderCategory,
} from '../interfaces.js'
import { B2StorageProvider } from './b2-provider.js'
import { EagleStorageProvider } from './eagle-provider.js'
import { GitHubStorageProvider } from './github-provider.js'
import { LocalStorageProvider } from './local-provider.js'
import { S3StorageProvider } from './s3-provider.js'

type BuiltinProviderRegistration = {
  name: string
  factory: StorageProviderFactory
  category: StorageProviderCategory
}

const BUILTIN_PROVIDER_REGISTRATIONS: BuiltinProviderRegistration[] = [
  {
    name: 's3',
    category: 'remote',
    factory: (config) => new S3StorageProvider(config as S3Config),
  },
  {
    name: 'b2',
    category: 'remote',
    factory: (config) => new B2StorageProvider(config as B2Config),
  },
  {
    name: 'github',
    category: 'remote',
    factory: (config) => new GitHubStorageProvider(config as GitHubConfig),
  },
  {
    name: 'local',
    category: 'local',
    factory: (config) => new LocalStorageProvider(config as LocalConfig),
  },
  {
    name: 'eagle',
    category: 'local',
    factory: (config) => new EagleStorageProvider(config as EagleConfig),
  },
]

for (const registration of BUILTIN_PROVIDER_REGISTRATIONS) {
  StorageFactory.registerProvider(registration.name, registration.factory, {
    category: registration.category,
  })
}

export function getBuiltinStorageProviders(): readonly BuiltinProviderRegistration[] {
  return BUILTIN_PROVIDER_REGISTRATIONS
}
