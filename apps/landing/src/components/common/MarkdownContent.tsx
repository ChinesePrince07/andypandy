'use client'

import type { FC } from 'react'
import ReactMarkdown from 'react-markdown'

interface MarkdownContentProps {
  content: string
}

export const MarkdownContent: FC<MarkdownContentProps> = ({ content }) => {
  return (
    <div className="prose prose-invert prose-headings:text-white prose-p:text-white/80 prose-a:text-white prose-strong:text-white prose-ul:text-white/80 prose-ol:text-white/80 prose-li:text-white/80 prose-hr:border-white/20 max-w-none">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="mt-8 mb-6 text-3xl font-bold text-white first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-8 mb-4 text-2xl font-semibold text-white">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-6 mb-3 text-xl font-semibold text-white">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-4 leading-7 text-white/80">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 ml-6 list-disc space-y-2 text-white/80">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 ml-6 list-decimal space-y-2 text-white/80">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-7 text-white/80">{children}</li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-white underline underline-offset-2 hover:text-white/80"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-8 border-white/20" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
