'use client'

import { useState, useEffect, useCallback } from 'react'
import { Finding } from '@/types'

interface UseFindingsResult {
  findings: Finding[]
  total: number
  hasMore: boolean
  loading: boolean
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
}

export function useFindings(limit = 100): UseFindingsResult {
  const [findings, setFindings] = useState<Finding[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  
  const fetchFindings = useCallback(async (newOffset = 0, append = false) => {
    if (loading) return
    
    setLoading(true)
    try {
      const res = await fetch(`/api/findings?limit=${limit}&offset=${newOffset}`)
      const data = await res.json()
      
      if (append) {
        setFindings(prev => [...prev, ...data.findings])
      } else {
        setFindings(data.findings)
      }
      
      setTotal(data.total)
      setHasMore(data.hasMore)
      setOffset(newOffset)
    } catch (error) {
      console.error('Failed to fetch findings:', error)
    } finally {
      setLoading(false)
    }
  }, [limit, loading])
  
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return
    await fetchFindings(offset + limit, true)
  }, [hasMore, loading, offset, limit, fetchFindings])
  
  const refresh = useCallback(async () => {
    await fetchFindings(0, false)
  }, [fetchFindings])
  
  // Initial fetch
  useEffect(() => {
    fetchFindings()
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  
  // Periodic refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 10000)
    return () => clearInterval(interval)
  }, [refresh])
  
  return { findings, total, hasMore, loading, loadMore, refresh }
}
