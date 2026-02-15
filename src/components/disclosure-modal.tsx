'use client'

import { Finding } from '@/types'
import { PROVIDERS } from '@/lib/detectors'

interface DisclosureModalProps {
  finding: Finding
  onClose: () => void
}

export function DisclosureModal({ finding, onClose }: DisclosureModalProps) {
  const config = PROVIDERS[finding.provider]
  
  const issueTemplate = `## Security Issue: Exposed ${config.name} API Key

I found an exposed ${config.name} API key in your repository:
- File: \`${finding.filePath}\`${finding.line ? ` (line ${finding.line})` : ''}
- Key format: \`${finding.keyMasked}\`

**Action Required:**
1. Rotate the key immediately at the ${config.name} dashboard
2. Remove from git history using \`git filter-branch\` or BFG Repo-Cleaner
3. Consider using environment variables or a secrets manager

This was discovered by KeyScan during security research.
If this is a false positive, please disregard.

Thank you for keeping your code secure!`

  const handleCopy = () => {
    navigator.clipboard.writeText(issueTemplate)
  }
  
  const handleOpenFile = () => {
    window.open(finding.githubUrl, '_blank')
  }
  
  const handleOpenIssue = () => {
    const url = `https://github.com/${finding.repoOwner}/${finding.repoName}/issues/new?title=${encodeURIComponent('Security Issue: Exposed API Key')}&body=${encodeURIComponent(issueTemplate)}`
    window.open(url, '_blank')
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div 
        className="bg-bg-secondary border border-border rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium">Disclose Exposed Key</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
            ×
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-4 overflow-auto max-h-96">
          {/* Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-secondary block text-xs mb-1">Repository</span>
              <span className="font-mono">{finding.repoOwner}/{finding.repoName}</span>
            </div>
            <div>
              <span className="text-text-secondary block text-xs mb-1">Provider</span>
              <span style={{ color: config.color }}>{config.name}</span>
            </div>
            <div>
              <span className="text-text-secondary block text-xs mb-1">File</span>
              <span className="font-mono text-xs">
                {finding.filePath}
                {finding.line && `:${finding.line}`}
              </span>
            </div>
            <div>
              <span className="text-text-secondary block text-xs mb-1">Key</span>
              <code className="text-xs text-text-secondary">{finding.keyMasked}</code>
            </div>
          </div>
          
          {/* Issue Template */}
          <div>
            <span className="text-text-secondary block text-xs mb-2">Issue Template</span>
            <pre className="bg-bg-primary p-3 rounded text-xs font-mono overflow-auto whitespace-pre-wrap">
              {issueTemplate}
            </pre>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-sm bg-bg-tertiary hover:bg-border rounded transition-colors"
          >
            Copy Template
          </button>
          <button
            onClick={handleOpenFile}
            className="px-3 py-1.5 text-sm bg-bg-tertiary hover:bg-border rounded transition-colors"
          >
            Open File
          </button>
          <button
            onClick={handleOpenIssue}
            className="px-3 py-1.5 text-sm bg-provider-openai/20 text-provider-openai hover:bg-provider-openai/30 rounded transition-colors"
          >
            Open New Issue
          </button>
        </div>
      </div>
    </div>
  )
}
