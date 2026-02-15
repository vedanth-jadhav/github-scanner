'use client'

import { useState, useCallback } from 'react'
import { Header } from '@/components/header'
import { StatusBar } from '@/components/status-bar'
import { FindingsTable } from '@/components/findings-table'
import { DisclosureModal } from '@/components/disclosure-modal'
import { SettingsPanel } from '@/components/settings-panel'
import { useFindings } from '@/hooks/useFindings'
import { useScannerStatus } from '@/hooks/useScannerStatus'
import { Finding } from '@/types'

export default function Page() {
  const { status, tokens, start, stop } = useScannerStatus()
  const { findings, hasMore, loadMore } = useFindings()
  
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null)
  const [tokensList, setTokensList] = useState<Array<{
    id: string
    name: string | null
    active: boolean
    usage: number
    createdAt: Date
  }>>([])
  
  const handleStart = useCallback(async () => {
    await start()
  }, [start])
  
  const handleStop = useCallback(async () => {
    await stop()
  }, [stop])
  
  const handleOpenFile = useCallback((finding: Finding) => {
    window.open(finding.githubUrl, '_blank')
  }, [])
  
  const handleDisclose = useCallback((finding: Finding) => {
    setSelectedFinding(finding)
  }, [])
  
  const handleAddToken = useCallback(async (token: string, name?: string) => {
    await fetch('/api/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name }),
    })
    // Refresh tokens list
    const res = await fetch('/api/tokens')
    const data = await res.json()
    setTokensList(data.tokens)
  }, [])
  
  const handleRemoveToken = useCallback(async (id: string) => {
    await fetch('/api/tokens', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    // Refresh tokens list
    const res = await fetch('/api/tokens')
    const data = await res.json()
    setTokensList(data.tokens)
  }, [])
  
  // Load tokens when settings opens
  const handleOpenSettings = useCallback(async () => {
    const res = await fetch('/api/tokens')
    const data = await res.json()
    setTokensList(data.tokens)
    setSettingsOpen(true)
  }, [])
  
  return (
    <div className="flex flex-col h-screen">
      <Header
        running={status.running}
        onStart={handleStart}
        onStop={handleStop}
        onSettings={handleOpenSettings}
      />
      
      <StatusBar status={status} tokens={tokens} />
      
      <main className="flex-1 flex flex-col min-h-0">
        <FindingsTable
          findings={findings}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onOpenFile={handleOpenFile}
          onDisclose={handleDisclose}
        />
      </main>
      
      {settingsOpen && (
        <SettingsPanel
          tokens={tokensList}
          onClose={() => setSettingsOpen(false)}
          onAddToken={handleAddToken}
          onRemoveToken={handleRemoveToken}
        />
      )}
      
      {selectedFinding && (
        <DisclosureModal
          finding={selectedFinding}
          onClose={() => setSelectedFinding(null)}
        />
      )}
    </div>
  )
}
