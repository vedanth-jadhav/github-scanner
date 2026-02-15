import { db } from './db'
import { detectKeys, SCAN_EXTENSIONS, SKIP_FILE_PATTERNS, type Detection } from './detectors'
import { getRepoContents, getFileContent, fetchGHArchiveEvents, extractReposFromEvents } from './github'

export interface ScanResult {
  owner: string
  repo: string
  findings: Detection[]
  duration: number
  filesScanned: number
  error?: string
}

// Check if repo was already scanned
async function isAlreadyScanned(owner: string, repo: string): Promise<boolean> {
  const fullName = `${owner}/${repo}`
  const existing = await db.scannedRepo.findUnique({
    where: { fullName },
  })
  return !!existing
}

// Mark repo as scanned
async function markScanned(owner: string, repo: string, findings: number): Promise<void> {
  const fullName = `${owner}/${repo}`
  await db.scannedRepo.upsert({
    where: { fullName },
    create: { owner, name: repo, fullName, findings },
    update: { scannedAt: new Date(), findings },
  })
}

// Parallel file fetching
async function getFilesParallel(
  owner: string, 
  repo: string,
  maxFiles: number = 50,
  concurrency: number = 20
): Promise<Array<{ path: string; content: string }>> {
  const allFiles: Array<{ path: string; url: string }> = []
  const queue: string[] = ['']
  
  while (queue.length > 0 && allFiles.length < maxFiles) {
    const path = queue.shift()!
    const result = await getRepoContents(owner, repo, path)
    
    if (result.error) {
      if (result.rateLimited) {
        console.log(`Rate limited, skipping ${owner}/${repo}`)
      }
      continue
    }
    if (!result.data) continue
    
    for (const item of result.data) {
      if (SKIP_FILE_PATTERNS.some(p => p.test(item.path))) continue
      
      if (item.type === 'dir') {
        queue.push(item.path)
      } else if (item.type === 'file' && item.download_url) {
        const ext = '.' + item.name.split('.').pop()
        if (SCAN_EXTENSIONS.has(ext) || item.name.includes('.env')) {
          allFiles.push({ path: item.path, url: item.download_url })
        }
      }
    }
  }
  
  const files: Array<{ path: string; content: string }> = []
  
  for (let i = 0; i < allFiles.length; i += concurrency) {
    const batch = allFiles.slice(i, i + concurrency)
    const results = await Promise.all(
      batch.map(async (f) => {
        const content = await getFileContent(f.url)
        return content ? { path: f.path, content } : null
      })
    )
    
    for (const r of results) {
      if (r) files.push(r)
    }
  }
  
  return files
}

// Scan a single repository
export async function scanRepo(owner: string, repoName: string): Promise<ScanResult> {
  const startTime = Date.now()
  const findings: Detection[] = []
  let filesScanned = 0
  
  const fullName = `${owner}/${repoName}`
  
  try {
    if (await isAlreadyScanned(owner, repoName)) {
      return {
        owner,
        repo: repoName,
        findings: [],
        duration: 0,
        filesScanned: 0,
        error: 'Already scanned',
      }
    }
    
    const files = await getFilesParallel(owner, repoName, 50, 20)
    
    if (files.length === 0) {
      await markScanned(owner, repoName, 0)
      return {
        owner,
        repo: repoName,
        findings: [],
        duration: Date.now() - startTime,
        filesScanned: 0,
        error: 'No scannable files',
      }
    }
    
    console.log(`Scanning ${fullName}: ${files.length} files`)
    
    const allDetections = await Promise.all(
      files.map(async (file) => {
        const detections = await detectKeys(file.content, file.path)
        return { path: file.path, detections }
      })
    )
    
    for (const { path, detections } of allDetections) {
      filesScanned++
      
      for (const detection of detections) {
        try {
          const existing = await db.finding.findUnique({
            where: { keyHash: detection.keyHash },
          })
          
          if (!existing) {
            await db.finding.create({
              data: {
                provider: detection.provider,
                keyMasked: detection.keyMasked,
                keyHash: detection.keyHash,
                repoOwner: owner,
                repoName,
                filePath: path,
                line: detection.line,
                githubUrl: `https://github.com/${owner}/${repoName}/blob/main/${path}`,
              },
            })
            findings.push(detection)
          }
        } catch {}
      }
    }
    
    await markScanned(owner, repoName, findings.length)
    
    return {
      owner,
      repo: repoName,
      findings,
      duration: Date.now() - startTime,
      filesScanned,
    }
  } catch (error) {
    await markScanned(owner, repoName, 0)
    
    return {
      owner,
      repo: repoName,
      findings,
      duration: Date.now() - startTime,
      filesScanned,
      error: String(error),
    }
  }
}

// Scanner state
export interface ScannerState {
  running: boolean
  reposPerMinute: number
  queueSize: number
  totalFound: number
  totalScanned: number
  currentRepo: string | null
  scanningRepos: string[]
}

const state: ScannerState = {
  running: false,
  reposPerMinute: 0,
  queueSize: 0,
  totalFound: 0,
  totalScanned: 0,
  currentRepo: null,
  scanningRepos: [],
}

// Event emitter
type EventCallback = (data: unknown) => void
const listeners: Map<string, Set<EventCallback>> = new Map()

export function on(event: string, callback: EventCallback) {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event)!.add(callback)
  return () => listeners.get(event)?.delete(callback)
}

function emit(event: string, data: unknown) {
  listeners.get(event)?.forEach(cb => cb(data))
}

// Queue
const scanQueue: Array<{ owner: string; repo: string }> = []
const inProgress = new Set<string>()
const MAX_QUEUE_SIZE = 1000

export async function addToQueue(owner: string, repo: string): Promise<boolean> {
  const key = `${owner}/${repo}`
  
  if (scanQueue.length >= MAX_QUEUE_SIZE) return false
  if (inProgress.has(key)) return false
  if (await isAlreadyScanned(owner, repo)) return false
  
  scanQueue.push({ owner, repo })
  state.queueSize = scanQueue.length
  emit('queue', state)
  return true
}

export function getState(): ScannerState {
  return { ...state }
}

// PARALLEL SCANNER
let scannerRunning = false
const CONCURRENT_SCANS = 16

export async function startScanner() {
  if (scannerRunning) return
  scannerRunning = true
  
  state.running = true
  state.scanningRepos = []
  emit('status', state)
  
  let completedThisMinute = 0
  let lastMinuteReset = Date.now()
  
  const scanWorker = async (workerId: number) => {
    console.log(`Worker ${workerId} started`)
    while (scannerRunning) {
      const elapsed = Date.now() - lastMinuteReset
      if (completedThisMinute >= 500 && elapsed < 60000) {
        console.log(`Worker ${workerId} waiting for rate limit`)
        await new Promise(r => setTimeout(r, 60000 - elapsed))
        completedThisMinute = 0
        lastMinuteReset = Date.now()
      }
      
      const next = scanQueue.shift()
      if (!next) {
        await new Promise(r => setTimeout(r, 200))
        state.queueSize = scanQueue.length
        emit('status', state)
        continue
      }
      
      const { owner, repo } = next
      const key = `${owner}/${repo}`
      inProgress.add(key)
      
      console.log(`Worker ${workerId} scanning ${key}`)
      
      state.queueSize = scanQueue.length
      state.scanningRepos = Array.from(inProgress)
      state.currentRepo = state.scanningRepos[0] || null
      emit('status', state)
      
      const result = await scanRepo(owner, repo)
      
      console.log(`Worker ${workerId} done ${key}: ${result.findings.length} findings, ${result.filesScanned} files`)
      
      inProgress.delete(key)
      state.scanningRepos = Array.from(inProgress)
      state.currentRepo = state.scanningRepos[0] || null
      
      if (!result.error || result.error !== 'Already scanned') {
        completedThisMinute++
        state.reposPerMinute = completedThisMinute
        state.totalScanned++
      }
      
      state.totalFound += result.findings.length
      emit('status', state)
      
      if (result.findings.length > 0) {
        emit('finding', result)
      }
    }
    console.log(`Worker ${workerId} stopped`)
  }
  
  Promise.all(Array(CONCURRENT_SCANS).fill(0).map((_, i) => scanWorker(i)))
}

export function stopScanner() {
  scannerRunning = false
  state.running = false
  state.scanningRepos = []
  state.currentRepo = null
  emit('status', state)
}

// ============ GH ARCHIVE DISCOVERY ============

let discoveryRunning = false
let lastProcessedHour = new Date()

export async function startDiscovery() {
  if (discoveryRunning) return
  discoveryRunning = true
  
  const now = new Date()
  lastProcessedHour = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours() - 3,
    0,
    0,
    0
  ))
  
  const discover = async () => {
    while (discoveryRunning && scannerRunning) {
      try {
        if (scanQueue.length >= MAX_QUEUE_SIZE) {
          console.log(`Queue full (${scanQueue.length}), waiting...`)
          await new Promise(r => setTimeout(r, 10000))
          continue
        }
        
        const hourStr = lastProcessedHour.toISOString().slice(0, 13) + ':00:00.000Z'
        console.log(`Fetching GH Archive for ${hourStr}`)
        
        const events = await fetchGHArchiveEvents(lastProcessedHour)
        const repos = extractReposFromEvents(events)
        
        console.log(`Found ${repos.length} repos from ${events.length} events, queue: ${scanQueue.length}`)
        
        let added = 0
        for (const { owner, repo } of repos) {
          if (await addToQueue(owner, repo)) {
            added++
          }
        }
        console.log(`Added ${added} new repos to queue`)
        
        lastProcessedHour = new Date(lastProcessedHour.getTime() + 60 * 60 * 1000)
        
        const catchUpTime = new Date(Date.now() - 3 * 60 * 60 * 1000)
        
        if (lastProcessedHour >= catchUpTime) {
          await new Promise(r => setTimeout(r, 60 * 60 * 1000))
        }
      } catch (error) {
        console.error('Discovery error:', error)
        await new Promise(r => setTimeout(r, 60000))
      }
    }
  }
  
  discover()
}

export function stopDiscovery() {
  discoveryRunning = false
}
