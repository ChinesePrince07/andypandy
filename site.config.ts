import { merge } from 'es-toolkit/compat'

import userConfig from './config.json'

interface SiteConfig {
  name: string
  title: string
  description: string
  url: string
  accentColor: string
  author: Author
  social?: Social
}
interface Author {
  name: string
  url: string
  avatar?: string
}
interface Social {
  twitter: string
  github: string
}

const defaultConfig: SiteConfig = {
  name: "Innei's Photo Gallery",
  title: "Innei's Photo Gallery",
  description:
    'Capturing beautiful moments in life, documenting daily warmth and emotions through my lens.',
  url: 'https://gallery.innei.in',
  accentColor: '#007bff',
  author: {
    name: 'Photo Gallery',
    url: 'https://innei.in/',
    avatar: '//cdn.jsdelivr.net/gh/Innei/static@master/avatar.png',
  },
  social: {
    twitter: '@__oQuery',
    github: 'Innei',
  },
}
export const siteConfig: SiteConfig = merge(defaultConfig, userConfig) as any

export default siteConfig
