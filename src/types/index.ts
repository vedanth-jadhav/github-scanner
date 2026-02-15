import { PROVIDERS, ProviderKey } from '@/lib/detectors'

export type Provider = ProviderKey

export interface Finding {
  id: string
  provider: Provider
  keyMasked: string
  repoOwner: string
  repoName: string
  filePath: string
  line: number | null
  githubUrl: string
  foundAt: Date | string
  disclosed: boolean
  disclosedAt?: Date | string | null
}

export interface ScannerStatus {
  running: boolean
  reposPerMinute: number
  queueSize: number
  totalFound: number
  totalScanned: number
  currentRepo: string | null
  scanningRepos?: string[]
}

export interface TokenStatus {
  total: number
  available: number
  rateLimited: number
}
