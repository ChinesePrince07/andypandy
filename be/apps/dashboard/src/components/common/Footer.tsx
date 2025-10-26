import type { FC } from 'react'

export const Footer: FC = () => {
  return (
    <footer className="mt-10 flex flex-col items-center gap-2 pb-8 text-center text-xs text-text-tertiary">
      <p className="tracking-[0.24em] uppercase text-text-tertiary/70">
        afilmory dashboard
      </p>
      <p className="text-text-tertiary">
        Crafted for the first-run experience • You can revisit onboarding from
        settings later
      </p>
    </footer>
  )
}
