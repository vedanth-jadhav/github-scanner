'use client'

import { ScannerStatus, TokenStatus } from '@/types'

interface StatusBarProps {
  status: ScannerState
  tokens?: TokenStatus
}

interface ScannerState extends ScannerStatus {
  scanningRepos?: string[]
}

export function StatusBar({ status, tokens }: StatusBarProps) {
  const scanningRepos = (status as ScannerState).scanningRepos || 
    (status.currentRepo ? [status.currentRepo] : [])
  
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-bg-secondary border-b border-border text-sm overflow-hidden">
      {/* Scanning repos - left side */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {status.running && scanningRepos.length > 0 && (
          <>
            <span className="text-text-secondary flex-shrink-0">Scanning:</span>
            <div className="flex items-center gap-2 overflow-hidden">
              {scanningRepos.slice(0, 4).map((repo, i) => (
                <span 
                  key={i}
                  className="font-mono text-xs bg-bg-tertiary px-2 py-0.5 rounded truncate max-w-32"
                  title={repo}
                >
                  {repo}
                </span>
              ))}
              {scanningRepos.length > 4 && (
                <span className="text-text-secondary text-xs">
                  +{scanningRepos.length - 4} more
                </span>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Stats - right side */}
      <div className="flex items-center gap-6 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-text-secondary">Speed:</span>
          <span className="font-mono">{status.reposPerMinute}/min</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-text-secondary">Queue:</span>
          <span className="font-mono">{status.queueSize}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-text-secondary">Found:</span>
          <span className="font-mono text-provider-openai">{status.totalFound}</span>
        </div>
        
        {tokens && (
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">Tokens:</span>
            <span className="font-mono">
              {tokens.available}/{tokens.total}
            </span>
            {tokens.rateLimited > 0 && (
              <span className="text-provider-groq text-xs">({tokens.rateLimited} limited)</span>
            )}
          </div>
        )}
        
        {/* Live indicator */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span 
            className={`w-2 h-2 rounded-full ${
              status.running ? 'bg-provider-openai animate-pulse' : 'bg-text-secondary'
            }`} 
          />
          <span className="text-text-secondary">
            {status.running ? 'Live' : 'Idle'}
          </span>
        </div>
      </div>
    </div>
  )
}
