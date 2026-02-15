'use client'

import { PROVIDERS, ProviderKey } from '@/lib/detectors'
import { formatDistanceToNow } from 'date-fns'

interface FindingRowProps {
  id: string
  provider: ProviderKey
  keyMasked: string
  repoOwner: string
  repoName: string
  filePath: string
  line: number | null
  githubUrl: string
  foundAt: string
  disclosed: boolean
  onOpen: () => void
  onDisclose: () => void
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

export function FindingRow({
  provider,
  keyMasked,
  repoOwner,
  repoName,
  filePath,
  line,
  githubUrl,
  foundAt,
  onOpen,
  onDisclose,
}: FindingRowProps) {
  const config = PROVIDERS[provider]
  
  return (
    <div className="group flex items-center gap-4 px-4 py-2.5 border-b border-border hover:bg-bg-tertiary transition-colors animate-fade-in">
      {/* Provider Badge */}
      <div className="w-8 flex-shrink-0">
        <span
          className="inline-flex items-center justify-center w-6 h-6 text-xs font-mono font-medium rounded"
          style={{ 
            backgroundColor: `${config.color}20`,
            color: config.color,
          }}
          title={config.name}
        >
          {LETTERS[provider]}
        </span>
      </div>
      
      {/* Masked Key */}
      <div className="w-48 flex-shrink-0">
        <code className="text-text-secondary text-xs">{keyMasked}</code>
      </div>
      
      {/* Repository & File */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5 text-sm">
        <span className="text-text-primary truncate">{repoOwner}/{repoName}</span>
        <span className="text-text-secondary flex-shrink-0">│</span>
        <span className="text-text-secondary text-xs truncate">
          {filePath}
          {line && `:${line}`}
        </span>
      </div>
      
      {/* Found Time */}
      <div className="w-24 flex-shrink-0 text-right">
        <span className="text-text-secondary text-xs">
          {formatDistanceToNow(new Date(foundAt), { addSuffix: true })}
        </span>
      </div>
      
      {/* Actions */}
      <div className="w-20 flex-shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onOpen}
          className="text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          Open
        </button>
        <button
          onClick={onDisclose}
          className="text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          Disclose
        </button>
      </div>
    </div>
  )
}
