'use client'

import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'

import { NocturneButton } from './NocturneButton'

interface CreateSpaceModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CreateSpaceModal = ({
  isOpen,
  onClose,
}: CreateSpaceModalProps) => {
  const [subdomain, setSubdomain] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState('')

  const handleSubdomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replaceAll(/[^a-z0-9-]/g, '')
    setSubdomain(value)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!subdomain) {
      setError('请输入你想要的空间名称')
      return
    }

    if (subdomain.length < 3) {
      setError('空间名称至少需要 3 个字符')
      return
    }

    setIsChecking(true)
    // TODO: 实际的域名检查和注册逻辑
    setTimeout(() => {
      setIsChecking(false)
      // 这里应该跳转到下一步或显示成功消息
      alert(`太棒了！你的专属空间 ${subdomain}.afilmory.art 已创建`)
      onClose()
    }, 1500)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal 内容 */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <m.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-lg overflow-hidden rounded-[32px] border border-white/10 bg-linear-to-b from-[#0a0a0a] via-[#050505] to-black shadow-[0_30px_120px_rgba(0,0,0,0.9)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 背景装饰 */}
              <div className="pointer-events-none absolute inset-0 opacity-40">
                <div className="absolute inset-x-12 inset-y-10 rounded-4xl bg-[radial-gradient(circle_at_top,#2a2a2a,transparent_70%)] blur-3xl" />
              </div>

              {/* 内容区域 */}
              <div className="relative p-8 sm:p-10">
                {/* 关闭按钮 */}
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute top-6 right-6 flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
                  aria-label="关闭"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M1 1L11 11M11 1L1 11"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>

                {/* 标题区域 */}
                <div className="mb-8 text-center">
                  <p className="text-xs tracking-[0.5em] text-white/40 uppercase">
                    Create Your Space
                  </p>
                  <h2 className="mt-4 font-serif text-3xl leading-tight text-white sm:text-4xl">
                    创建你的专属空间
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-white/70">
                    为你的影像档案馆选择一个独一无二的名字
                    <br />
                    这将成为你的专属网址
                  </p>
                </div>

                {/* 表单 */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* 输入框 */}
                  <div className="space-y-3">
                    <label className="block text-xs tracking-wider text-white/60">
                      你的空间名称
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={subdomain}
                        onChange={handleSubdomainChange}
                        placeholder="例如：myspace"
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 pr-32 text-base text-white transition-colors placeholder:text-white/30 focus:border-white/30 focus:bg-white/8 focus:outline-none"
                        autoFocus
                      />
                      <div className="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2 text-sm text-white/50">
                        .afilmory.art
                      </div>
                    </div>
                    {error && (
                      <p className="text-xs text-red-400/80">{error}</p>
                    )}
                  </div>

                  {/* 预览 */}
                  {subdomain && !error && (
                    <m.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <p className="mb-2 text-xs tracking-wider text-white/50">
                        你的专属网址将是：
                      </p>
                      <p className="font-mono text-sm text-white">
                        https://{subdomain}.afilmory.art
                      </p>
                    </m.div>
                  )}

                  {/* 提示信息 */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="mb-2 text-xs font-medium tracking-wider text-white">
                      💡 小提示
                    </p>
                    <ul className="space-y-1.5 text-xs leading-relaxed text-white/60">
                      <li>• 只能使用英文字母、数字和连字符 (-)</li>
                      <li>• 至少 3 个字符，建议简短易记</li>
                      <li>• 一旦创建，名称将不可更改</li>
                    </ul>
                  </div>

                  {/* 按钮组 */}
                  <div className="flex flex-col gap-3 sm:flex-row-reverse">
                    <NocturneButton
                      type="submit"
                      disabled={isChecking || !subdomain}
                      className="flex-1 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isChecking ? '检查中...' : '创建我的空间'}
                    </NocturneButton>
                    <NocturneButton
                      type="button"
                      variant="secondary"
                      onClick={onClose}
                      className="flex-1"
                    >
                      稍后再说
                    </NocturneButton>
                  </div>
                </form>
              </div>
            </m.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
