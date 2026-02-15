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
    <div className="flex flex-col bg-bg-secondary border-b border-border text-sm">
      {/* Main stats row */}
      <div className="flex items-center gap-4 px-4 py-2">
        {/* Scanning repos - left side */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {status.running && scanningRepos.length > 0 && (
            <>
              <span className="text-text-secondary flex-shrink-0">Scanning:</span>
              <div className="flex items-center gap-1.5 overflow-hidden">
                {scanningRepos.slice(0, 3).map((repo, i) => (
                  <span 
                    key={i}
                    className="font-mono text-xs bg-bg-tertiary px-2 py-0.5 rounded truncate max-w-28"
                    title={repo}
                  >
                    {repo}
                  </span>
                ))}
                {scanningRepos.length > 3 && (
                  <span className="text-text-secondary text-xs">
                    +{scanningRepos.length - 3}
                  </span>
                )}
              </div>
            </>
          )}
          {!status.running && (
            <span className="text-text-secondary">Ready to scan</span>
          )}
        </div>
        
        {/* Stats - right side */}
        <div className="flex items-center gap-5 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-text-secondary text-xs">Speed</span>
            <span className="font-mono text-provider-gemini">{status.reposPerMinute}<span className="text-text-secondary text-xs">/min</span></span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <span className="text-text-secondary text-xs">Scanned</span>
            <span className="font-mono">{status.totalScanned || 0}</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <span className="text-text-secondary text-xs">Queue</span>
            <span className="font-mono">{status.queueSize}</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <span className="text-text-secondary text-xs">Found</span>
            <span className="font-mono text-provider-openai font-medium">{status.totalFound}</span>
          </div>
          
          {tokens && (
            <div className="flex items-center gap-1.5">
              <span className="text-text-secondary text-xs">Tokens</span>
              <span className="font-mono">
                {tokens.available}/{tokens.total}
              </span>
              {tokens.rateLimited > 0 && (
                <span className="text-provider-groq text-xs">({tokens.rateLimited} lim)</span>
              )}
            </div>
          )}
          
          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <span 
              className={`w-2 h-2 rounded-full ${
                status.running ? 'bg-provider-openai animate-pulse' : 'bg-text-secondary'
              }`} 
            />
            <span className={`text-xs ${status.running ? 'text-provider-openai' : 'text-text-secondary'}`}>
              {status.running ? 'LIVE' : 'IDLE'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Progress bar */}
      {status.running && (
        <div className="h-1 bg-bg-tertiary">
          <div 
            className="h-full bg-gradient-to-r from-provider-openai via-provider-anthropic to-provider-gemini transition-all duration-300"
            style={{ 
              width: `${Math.min(100, (status.reposPerMinute / 200) * 100)}%`,
            }}
          />
        </div>
      )}
    </div>
  )
}
