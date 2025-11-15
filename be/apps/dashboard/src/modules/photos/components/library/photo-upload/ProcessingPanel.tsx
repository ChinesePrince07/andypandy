import { LinearBorderPanel } from '~/components/common/GlassPanel'

import { STAGE_CONFIG, STAGE_ORDER,SUMMARY_FIELDS } from './constants'
import type { ProcessingState } from './types'

type ProcessingPanelProps = {
  state: ProcessingState | null
}

export function ProcessingPanel({ state }: ProcessingPanelProps) {
  if (!state) {
    return (
      <LinearBorderPanel className="bg-background/40 px-3 py-4 text-center text-xs text-text-tertiary">
        正在等待服务器处理开始...
      </LinearBorderPanel>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {STAGE_ORDER.map((stage) => {
          const stageState = state.stages[stage]
          const ratio = stageState.total === 0 ? 1 : Math.min(1, stageState.processed / stageState.total)
          const config = STAGE_CONFIG[stage]
          return (
            <LinearBorderPanel key={stage} className="bg-fill/10 px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text font-medium">{config.label}</span>
                <span className="text-text-tertiary">
                  {stageState.status === 'completed'
                    ? '已完成'
                    : stageState.total === 0
                      ? '无需处理'
                      : `${stageState.processed} / ${stageState.total}`}
                </span>
              </div>
              <div className="bg-fill/20 mt-2 h-1.5 rounded-full">
                <div className="bg-accent h-full rounded-full" style={{ width: `${ratio * 100}%` }} />
              </div>
              <p className="text-text-tertiary mt-1 text-[11px]">{config.description}</p>
            </LinearBorderPanel>
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SUMMARY_FIELDS.map((field) => (
          <LinearBorderPanel key={field.key} className="bg-background/40 px-3 py-2 text-xs">
            <p className="text-text-tertiary uppercase tracking-wide">{field.label}</p>
            <p className="text-text mt-1 text-lg font-semibold">{state.summary[field.key]}</p>
          </LinearBorderPanel>
        ))}
      </div>
      {state.latestLog ? (
        <LinearBorderPanel className="bg-background/50 px-3 py-2 text-[11px] text-text-tertiary">
          <span className="font-medium text-text">最新日志：</span>
          <span className="ml-1">{state.latestLog.message}</span>
        </LinearBorderPanel>
      ) : null}
    </div>
  )
}
