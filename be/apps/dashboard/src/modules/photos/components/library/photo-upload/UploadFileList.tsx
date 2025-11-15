import { Spring } from '@afilmory/utils'
import { m } from 'motion/react'

import { LinearBorderPanel } from '~/components/common/GlassPanel'

import { FILE_STATUS_CLASS, FILE_STATUS_LABEL } from './constants'
import type { FileProgressEntry } from './types'
import { formatBytes } from './utils'

type UploadFileListProps = {
  entries: FileProgressEntry[]
  overallProgress: number
}

export function UploadFileList({ entries, overallProgress }: UploadFileListProps) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-text-tertiary">
        <span>上传进度</span>
        <span>{Math.round(overallProgress * 100)}%</span>
      </div>
      <div className="bg-fill/20 mt-2 h-2 rounded-full">
        <m.div
          className="bg-accent h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${overallProgress * 100}%` }}
          transition={Spring.presets.smooth}
        />
      </div>
      <LinearBorderPanel className="bg-background/60 mt-4 max-h-60 overflow-auto">
        <m.ul
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={Spring.presets.smooth}
          className="divide-fill-tertiary/30"
        >
          {entries.map((entry) => (
            <li
              key={`${entry.name}-${entry.index}`}
              className="text-text-secondary flex flex-col gap-2 px-4 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="truncate" title={entry.name}>
                    {entry.name}
                  </span>
                  <p className="text-text-tertiary text-[11px]">{formatBytes(entry.size)}</p>
                </div>
                <span className={`${FILE_STATUS_CLASS[entry.status]} text-[11px] font-medium`}>
                  {FILE_STATUS_LABEL[entry.status]}
                </span>
              </div>
              <div className="bg-fill/20 h-1.5 rounded-full">
                <div
                  className={
                    entry.status === 'done'
                      ? 'bg-emerald-400 h-full rounded-full'
                      : entry.status === 'error'
                        ? 'bg-rose-400 h-full rounded-full'
                        : entry.status === 'processing'
                          ? 'bg-amber-300 h-full rounded-full'
                          : 'bg-accent h-full rounded-full'
                  }
                  style={{ width: `${Math.min(100, entry.progress * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </m.ul>
      </LinearBorderPanel>
    </div>
  )
}
