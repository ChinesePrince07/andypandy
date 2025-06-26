import { AnimatePresence, m } from 'motion/react'
import { useCallback, useState } from 'react'
import { tv } from 'tailwind-variants'

import { clsxm } from '~/lib/cn'
import { Spring } from '~/lib/spring'

const reactions = ['👍', '😍', '🔥', '👏', '🌟', '🙌'] as const

interface ReactionButtonProps {
  onReaction?: (reaction: (typeof reactions)[number]) => void
  className?: string
  disabled?: boolean
}

const reactionButton = tv({
  slots: {
    base: 'relative z-[99]',
    mainButton: [
      'relative z-10 flex size-10 items-center justify-center rounded-full',
      'border border-white/20 !bg-black/70 text-white/80 shadow-2xl backdrop-blur-[70px]',
      'bg-gradient-to-br from-white/20 to-white/0',
      'transition-colors duration-300',
      'hover:border-white/30',
      'active:scale-95',
      'disabled:cursor-not-allowed disabled:opacity-50',
    ],
    mainButtonIcon: 'text-lg',
    reactionsContainer: [
      'absolute bottom-full mb-4 flex items-center justify-center gap-2',
      'left-1/2 -translate-x-1/2',
      'rounded-full border-white/20 !bg-black/70 p-2 shadow-2xl backdrop-blur-[70px]',
      'bg-gradient-to-br from-white/20 to-white/0',
    ],
    reactionItem: [
      'flex size-10 items-center justify-center',
      'cursor-pointer text-xl',
    ],
  },
})

const emojiContainerVariants = {
  open: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: Spring.presets.snappy,
  },
  closed: {
    opacity: 0,
    scale: 0.2,
    y: 50,
    transition: Spring.presets.snappy,
  },
}

const emojiVariants = {
  open: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: Spring.presets.snappy,
  },
  closed: {
    opacity: 0,
    y: 10,
    scale: 0.8,
    transition: Spring.presets.snappy,
  },
}

const iconVariants = {
  open: { rotate: 180 },
  closed: { rotate: 0 },
}

export const ReactionButton = ({
  onReaction,
  className,
  disabled = false,
}: ReactionButtonProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const styles = reactionButton()

  const handleReactionClick = useCallback(
    (reaction: (typeof reactions)[number]) => {
      onReaction?.(reaction)
      setIsOpen(false)
    },
    [onReaction],
  )

  return (
    <div className={clsxm(styles.base(), className)}>
      <m.div
        className="relative"
        initial="closed"
        exit={{
          opacity: 0,
          scale: 0,
          transition: { duration: 0.2 },
        }}
        animate={isOpen ? 'open' : 'closed'}
      >
        <AnimatePresence>
          {isOpen && (
            <m.div
              className="fixed inset-0 z-[-1]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isOpen && (
            <m.div
              className={styles.reactionsContainer()}
              variants={emojiContainerVariants}
              initial="closed"
              animate="open"
              exit="closed"
            >
              {reactions.map((reaction, index) => (
                <m.button
                  key={index}
                  className={styles.reactionItem()}
                  variants={emojiVariants}
                  onClick={() => handleReactionClick(reaction)}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <span className="select-none">{reaction}</span>
                </m.button>
              ))}
            </m.div>
          )}
        </AnimatePresence>

        <m.button
          className={styles.mainButton()}
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-expanded={isOpen}
          aria-label="React to photo"
        >
          <m.div variants={iconVariants}>
            <AnimatePresence mode="popLayout">
              <m.i
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0 } }}
                transition={Spring.presets.smooth}
                key={isOpen ? 'close' : 'emoji'}
                className={
                  isOpen ? 'i-mingcute-close-line' : 'i-mingcute-emoji-line'
                }
              />
            </AnimatePresence>
          </m.div>
        </m.button>
      </m.div>
    </div>
  )
}
