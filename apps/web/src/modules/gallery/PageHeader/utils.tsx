export function resolveSocialUrl(
  value: string,
  { baseUrl, stripAt }: { baseUrl: string; stripAt?: boolean },
): string | undefined {
  const trimmed = value.trim()

  if (!trimmed) {
    return undefined
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  const normalized = stripAt ? trimmed.replace(/^@/, '') : trimmed
  if (!normalized) {
    return undefined
  }
  return `${baseUrl}${normalized}`
}

// 小型社交按钮样式（用于 PageHeaderLeft）
export const SocialIconButton = ({ icon, title, href }: { icon: string; title: string; href: string }) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex size-6 items-center justify-center rounded-md text-white/40 transition-colors duration-200 hover:text-white/80"
      title={title}
    >
      <i className={`${icon} text-base`} />
    </a>
  )
}

// 统一的圆形按钮样式（用于 PageHeaderRight）
export const ActionIconButton = ({
  icon,
  title,
  onClick,
  badge,
  href,
}: {
  icon: string
  title: string
  onClick?: () => void
  badge?: number
  href?: string
}) => {
  const commonClasses =
    'relative flex size-9 items-center justify-center rounded-full bg-white/10 text-white/60 transition-all duration-200 hover:bg-white/20 hover:text-white lg:size-10'

  const content = (
    <>
      <i className={`${icon} text-base lg:text-lg`} />
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-medium text-white">
          {badge}
        </span>
      )}
    </>
  )

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={commonClasses} title={title}>
        {content}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} className={commonClasses} title={title}>
      {content}
    </button>
  )
}
