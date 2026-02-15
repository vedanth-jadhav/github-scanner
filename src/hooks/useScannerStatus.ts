'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ScannerStatus, TokenStatus } from '@/types'

interface ScannerState extends ScannerStatus {
  scanningRepos?: string[]
}

interface UseScannerStatusResult {
  status: ScannerState
  tokens: TokenStatus
  start: () => Promise<void>
  stop: () => Promise<void>
}

export function useScannerStatus(): UseScannerStatusResult {
  const [status, setStatus] = useState<ScannerState>({
    running: false,
    reposPerMinute: 0,
    queueSize: 0,
    totalFound: 0,
    currentRepo: null,
    scanningRepos: [],
  })
  
  const [tokens, setTokens] = useState<TokenStatus>({
    total: 0,
    available: 0,
    rateLimited: 0,
  })
  
  const eventSourceRef = useRef<EventSource | null>(null)
  
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/scan')
      const data = await res.json()
      setStatus({
        running: data.running,
        reposPerMinute: data.reposPerMinute,
        queueSize: data.queueSize,
        totalFound: data.totalFound,
        currentRepo: data.currentRepo,
        scanningRepos: data.scanningRepos || (data.currentRepo ? [data.currentRepo] : []),
      })
      setTokens(data.tokens || { total: 0, available: 0, rateLimited: 0 })
    } catch (error) {
      console.error('Failed to fetch status:', error)
    }
  }, [])
  
  useEffect(() => {
    fetchStatus()
    
    const connectSSE = () => {
      const es = new EventSource('/api/events')
      eventSourceRef.current = es
      
      es.onopen = () => console.log('SSE connected')
      
      es.addEventListener('status', (event) => {
        try {
          const data = JSON.parse(event.data)
          setStatus(prev => ({
            ...prev,
            ...data,
            scanningRepos: data.scanningRepos || (data.currentRepo ? [data.currentRepo] : prev.scanningRepos || []),
          }))
        } catch (e) {
          console.error('Failed to parse status event:', e)
        }
      })
      
      es.addEventListener('queue', (event) => {
        try {
          const data = JSON.parse(event.data)
          setStatus(prev => ({ ...prev, queueSize: data.queueSize }))
        } catch (e) {
          console.error('Failed to parse queue event:', e)
        }
      })
      
      es.addEventListener('finding', () => {
        fetchStatus()
      })
      
      es.onerror = () => {
        es.close()
        setTimeout(connectSSE, 3000)
      }
    }
    
    connectSSE()
    
    const interval = setInterval(fetchStatus, 5000)
    
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close()
      clearInterval(interval)
    }
  }, [fetchStatus])
  
  const start = useCallback(async () => {
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
      const data = await res.json()
      setStatus(data.state)
      fetchStatus()
    } catch (error) {
      console.error('Failed to start scanner:', error)
    }
  }, [fetchStatus])
  
  const stop = useCallback(async () => {
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })
      const data = await res.json()
      setStatus(data.state)
      fetchStatus()
    } catch (error) {
      console.error('Failed to stop scanner:', error)
    }
  }, [fetchStatus])
  
  return { status, tokens, start, stop }
}
