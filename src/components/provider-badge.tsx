'use client'

import { PROVIDERS, ProviderKey } from '@/lib/detectors'

interface ProviderBadgeProps {
  provider: ProviderKey
  onClick?: () => void
  active?: boolean
}

const LETTERS: Record<ProviderKey, string> = {
  openai: 'O',
  anthropic: 'A',
  gemini: 'G',
  groq: 'Q',
  cerebras: 'C',
  openrouter: 'R',
  grok: 'X',
}

export function ProviderBadge({ provider, onClick, active }: ProviderBadgeProps) {
  const config = PROVIDERS[provider]
  
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center justify-center
        w-6 h-6 text-xs font-mono font-medium
        rounded transition-colors
        ${active ? 'ring-1 ring-text-secondary' : ''}
      `}
      style={{ 
        backgroundColor: `${config.color}20`,
        color: config.color,
      }}
      title={config.name}
    >
      {LETTERS[provider]}
    </button>
  )
}

export function ProviderLabel({ provider }: { provider: ProviderKey }) {
  const config = PROVIDERS[provider]
  
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium"
      style={{ 
        backgroundColor: `${config.color}15`,
        color: config.color,
      }}
    >
      <span className="font-mono">{LETTERS[provider]}</span>
      <span>{config.name}</span>
    </span>
  )
}
