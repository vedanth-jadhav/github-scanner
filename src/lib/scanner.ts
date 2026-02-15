import { db } from './db'
import { detectKeys, SCAN_EXTENSIONS, SKIP_FILE_PATTERNS, type Detection } from './detectors'
import { getRepoContents, getFileContent, getPublicEvents } from './github'

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
  maxFiles: number = 30,
  concurrency: number = 10
): Promise<Array<{ path: string; content: string }>> {
  const allFiles: Array<{ path: string; url: string }> = []
  const queue: string[] = ['']
  
  while (queue.length > 0 && allFiles.length < maxFiles) {
    const path = queue.shift()!
    const result = await getRepoContents(owner, repo, path)
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
    
    const files = await getFilesParallel(owner, repoName)
    
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

// Scanner state with tracking for multiple repos
export interface ScannerState {
  running: boolean
  reposPerMinute: number
  queueSize: number
  totalFound: number
  currentRepo: string | null
  scanningRepos: string[]  // All repos currently being scanned
}

const state: ScannerState = {
  running: false,
  reposPerMinute: 0,
  queueSize: 0,
  totalFound: 0,
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

export async function addToQueue(owner: string, repo: string): Promise<boolean> {
  const key = `${owner}/${repo}`
  
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
const CONCURRENT_SCANS = 8

export async function startScanner() {
  if (scannerRunning) return
  scannerRunning = true
  
  state.running = true
  state.scanningRepos = []
  emit('status', state)
  
  let completedThisMinute = 0
  let lastMinuteReset = Date.now()
  
  const scanWorker = async (workerId: number) => {
    while (scannerRunning) {
      const elapsed = Date.now() - lastMinuteReset
      if (completedThisMinute >= 250 && elapsed < 60000) {
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
      
      // Add to scanning repos list
      state.queueSize = scanQueue.length
      state.scanningRepos = Array.from(inProgress)
      state.currentRepo = state.scanningRepos[0] || null
      emit('status', state)
      
      const result = await scanRepo(owner, repo)
      
      inProgress.delete(key)
      
      // Remove from scanning repos list
      state.scanningRepos = Array.from(inProgress)
      state.currentRepo = state.scanningRepos[0] || null
      
      if (!result.error || result.error !== 'Already scanned') {
        completedThisMinute++
        state.reposPerMinute = completedThisMinute
      }
      
      state.totalFound += result.findings.length
      emit('status', state)
      
      if (result.findings.length > 0) {
        emit('finding', result)
      }
    }
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

// Discovery
let discoveryLoop: ReturnType<typeof setTimeout> | null = null
let lastEtag: string | undefined = undefined

export async function startDiscovery() {
  const poll = async () => {
    if (!scannerRunning) return
    
    const { events, newEtag, pollInterval } = await getPublicEvents(lastEtag)
    
    if (newEtag) {
      lastEtag = newEtag
      
      for (const event of events) {
        if (event.type === 'CreateEvent' || event.type === 'PushEvent' || event.type === 'PublicEvent') {
          const [owner, repo] = event.repo.name.split('/')
          if (owner && repo) {
            await addToQueue(owner, repo)
          }
        }
      }
    }
    
    if (scannerRunning) {
      discoveryLoop = setTimeout(poll, Math.max(pollInterval * 1000, 30000))
    }
  }
  
  poll()
}

export function stopDiscovery() {
  if (discoveryLoop) {
    clearTimeout(discoveryLoop)
    discoveryLoop = null
  }
}
