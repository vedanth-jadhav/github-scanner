'use client'

import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { FindingRow } from './finding-row'
import { ProviderKey } from '@/lib/detectors'
import { Finding } from '@/types'

interface FindingsTableProps {
  findings: Finding[]
  hasMore: boolean
  onLoadMore: () => void
  onOpenFile: (finding: Finding) => void
  onDisclose: (finding: Finding) => void
}

export function FindingsTable({
  findings,
  hasMore,
  onLoadMore,
  onOpenFile,
  onDisclose,
}: FindingsTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<ProviderKey | null>(null)
  
  const filteredFindings = filter 
    ? findings.filter(f => f.provider === filter)
    : findings
  
  const count = filteredFindings.length + (hasMore ? 1 : 0)
  
  const rowVirtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 5,
  })
  
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Table Header */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-bg-secondary text-xs">
        <span className="text-text-secondary uppercase tracking-wide w-8">Prov</span>
        <span className="text-text-secondary uppercase tracking-wide w-48">Key</span>
        <span className="text-text-secondary uppercase tracking-wide flex-1">Repo / File</span>
        <span className="text-text-secondary uppercase tracking-wide w-24">Found</span>
        <span className="w-20" />
      </div>
      
      {/* Virtualized Table Body */}
      <div 
        ref={parentRef}
        className="flex-1 overflow-auto"
      >
        {filteredFindings.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
            No findings yet. Click Start to begin scanning.
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const index = virtualRow.index
              
              // Load more row
              if (index >= filteredFindings.length) {
                return (
                  <div
                    key="load-more"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="flex items-center justify-center"
                  >
                    <button
                      onClick={onLoadMore}
                      className="text-sm text-text-secondary hover:text-text-primary"
                    >
                      Load more
                    </button>
                  </div>
                )
              }
              
              const finding = filteredFindings[index]
              
              return (
                <div
                  key={finding.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <FindingRow
                    id={finding.id}
                    provider={finding.provider}
                    keyMasked={finding.keyMasked}
                    repoOwner={finding.repoOwner}
                    repoName={finding.repoName}
                    filePath={finding.filePath}
                    line={finding.line}
                    githubUrl={finding.githubUrl}
                    foundAt={typeof finding.foundAt === 'string' ? finding.foundAt : finding.foundAt.toISOString()}
                    disclosed={finding.disclosed}
                    onOpen={() => onOpenFile(finding)}
                    onDisclose={() => onDisclose(finding)}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
