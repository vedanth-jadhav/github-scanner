'use client'

import { useState } from 'react'

interface Token {
  id: string
  name: string | null
  active: boolean
  usage: number
  createdAt: Date
}

interface SettingsPanelProps {
  tokens: Token[]
  onClose: () => void
  onAddToken: (token: string, name?: string) => void
  onRemoveToken: (id: string) => void
}

export function SettingsPanel({ tokens, onClose, onAddToken, onRemoveToken }: SettingsPanelProps) {
  const [newToken, setNewToken] = useState('')
  const [newName, setNewName] = useState('')
  
  const handleAdd = () => {
    if (newToken.trim()) {
      onAddToken(newToken.trim(), newName.trim() || undefined)
      setNewToken('')
      setNewName('')
    }
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div 
        className="bg-bg-secondary border border-border rounded-lg w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium">Settings</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary"
          >
            ×
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Tokens Section */}
          <div>
            <label className="text-text-secondary text-xs uppercase tracking-wide block mb-2">
              GitHub Tokens
            </label>
            
            {/* Token List */}
            <div className="space-y-2 mb-3">
              {tokens.length === 0 ? (
                <div className="text-text-secondary text-sm py-2">
                  No tokens configured. Add a GitHub PAT to increase rate limits.
                </div>
              ) : (
                tokens.map(token => (
                  <div 
                    key={token.id}
                    className="flex items-center justify-between bg-bg-primary px-3 py-2 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">
                        {token.name || 'ghp_****...****'}
                      </span>
                      <span className="text-text-secondary text-xs">
                        ({token.usage} uses)
                      </span>
                    </div>
                    <button
                      onClick={() => onRemoveToken(token.id)}
                      className="text-text-secondary hover:text-provider-groq text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
            
            {/* Add Token Form */}
            <div className="space-y-2">
              <input
                type="text"
                value={newToken}
                onChange={e => setNewToken(e.target.value)}
                placeholder="ghp_xxxx..."
                className="w-full px-3 py-2 bg-bg-primary border border-border rounded text-sm font-mono focus:outline-none focus:border-text-secondary"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Token name (optional)"
                  className="flex-1 px-3 py-2 bg-bg-primary border border-border rounded text-sm focus:outline-none focus:border-text-secondary"
                />
                <button
                  onClick={handleAdd}
                  disabled={!newToken.trim()}
                  className="px-3 py-2 text-sm bg-bg-tertiary hover:bg-border rounded transition-colors disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
          
          {/* Help */}
          <div className="text-text-secondary text-xs space-y-1 pt-2 border-t border-border">
            <p>• Personal Access Tokens: 5,000 requests/hour each</p>
            <p>• Multiple tokens enable faster scanning</p>
            <p>• Tokens are stored locally and never shared</p>
          </div>
        </div>
      </div>
    </div>
  )
}
