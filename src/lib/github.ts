import { db } from './db'
import { createGunzip } from 'node:zlib'
import { get as httpGet } from 'node:http'
import { get as httpsGet } from 'node:https'

// GH Archive - Free, no rate limits
// https://data.gharchive.org/{YYYY-MM-DD-H}.json.gz

interface GHArchiveEvent {
  type: string
  repo: {
    id: number
    name: string
    url: string
  }
  actor: {
    login: string
  }
  created_at: string
  payload?: {
    ref?: string
    ref_type?: string
  }
}

// Token pool for optional GitHub API calls (scanning files)
interface TokenInfo {
  token: string
  usage: number
  lastUsed: number
  rateLimited: boolean
  resetAt: number
}

class TokenPool {
  private tokens: TokenInfo[] = []
  private initialized = false
  private initPromise: Promise<void> | null = null
  
  async initialize() {
    if (this.initPromise) return this.initPromise
    
    this.initPromise = this.doInitialize()
    return this.initPromise
  }
  
  private async doInitialize() {
    const storedTokens = await db.token.findMany({
      where: { active: true },
      orderBy: { usage: 'asc' },
    })
    
    if (storedTokens.length === 0) {
      const envTokens = process.env.GITHUB_TOKENS?.split(',').map(t => t.trim()).filter(Boolean) || []
      for (const token of envTokens) {
        await this.addTokenToDb(token)
      }
    } else {
      this.tokens = storedTokens.map(t => ({
        token: t.token,
        usage: t.usage,
        lastUsed: t.usedAt?.getTime() || 0,
        rateLimited: false,
        resetAt: 0,
      }))
    }
    
    this.initialized = true
  }
  
  private async addTokenToDb(token: string, name?: string): Promise<boolean> {
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Invalid token')
      
      await db.token.upsert({
        where: { token },
        create: { token, name },
        update: { active: true },
      })
      
      this.tokens.push({
        token,
        usage: 0,
        lastUsed: 0,
        rateLimited: false,
        resetAt: 0,
      })
      
      return true
    } catch {
      return false
    }
  }
  
  async addToken(token: string, name?: string) {
    if (!this.initialized) await this.initialize()
    return this.addTokenToDb(token, name)
  }
  
  getToken(): string | null {
    if (this.tokens.length === 0) return null
    
    const now = Date.now()
    const available = this.tokens.filter(t => !t.rateLimited || t.resetAt < now)
    
    if (available.length === 0) return null
    
    available.sort((a, b) => a.usage - b.usage)
    return available[0].token
  }
  
  markUsed(token: string) {
    const t = this.tokens.find(x => x.token === token)
    if (t) {
      t.usage++
      t.lastUsed = Date.now()
      db.token.update({
        where: { token },
        data: { usage: { increment: 1 }, usedAt: new Date() },
      }).catch(() => {})
    }
  }
  
  markRateLimited(token: string, resetAt: number) {
    const t = this.tokens.find(x => x.token === token)
    if (t) {
      t.rateLimited = true
      t.resetAt = resetAt
    }
  }
  
  async getStatus() {
    if (!this.initialized && !this.initPromise) {
      this.initialize().catch(() => {})
    }
    if (this.initPromise) await this.initPromise
    
    return {
      total: this.tokens.length,
      available: this.tokens.filter(t => !t.rateLimited || t.resetAt < Date.now()).length,
      rateLimited: this.tokens.filter(t => t.rateLimited && t.resetAt >= Date.now()).length,
    }
  }
}

export const tokenPool = new TokenPool()

tokenPool.initialize().catch(() => {})

// ============ GH ARCHIVE ============

// Get events from GH Archive for a specific hour using streaming
export async function fetchGHArchiveEvents(date: Date): Promise<GHArchiveEvent[]> {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hour = date.getUTCHours()
  
  const url = `https://data.gharchive.org/${year}-${month}-${day}-${hour}.json.gz`
  
  console.log(`Fetching GH Archive: ${url}`)
  
  return new Promise((resolve) => {
    const events: GHArchiveEvent[] = []
    let buffer = ''
    let lineCount = 0
    let destroyed = false
    
    const get = url.startsWith('https') ? httpsGet : httpGet
    
    get(url, (res) => {
      if (res.statusCode !== 200) {
        console.error(`GH Archive fetch failed: ${res.statusCode}`)
        resolve([])
        return
      }
      
      const gunzip = createGunzip()
      
      res.pipe(gunzip)
      
      gunzip.on('data', (chunk: Buffer) => {
        if (destroyed) return
        
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (!line.trim()) continue
          lineCount++
          
          if (lineCount > 20000) {
            destroyed = true
            res.destroy()
            gunzip.destroy()
            console.log(`Got ${events.length} relevant events from ~${lineCount} lines`)
            resolve(events)
            return
          }
          
          try {
            const event = JSON.parse(line)
            if (
              event.type === 'CreateEvent' ||
              event.type === 'PushEvent' ||
              event.type === 'PublicEvent'
            ) {
              events.push(event)
            }
          } catch {}
          
          if (events.length >= 1000) {
            destroyed = true
            res.destroy()
            gunzip.destroy()
            console.log(`Got ${events.length} relevant events from ~${lineCount} lines`)
            resolve(events)
            return
          }
        }
      })
      
      gunzip.on('end', () => {
        console.log(`Got ${events.length} relevant events from ~${lineCount} lines`)
        resolve(events)
      })
      
      gunzip.on('error', (err: Error) => {
        console.error('Gunzip error:', err)
        resolve(events)
      })
    }).on('error', (err: Error) => {
      console.error('HTTP error:', err)
      resolve([])
    })
  })
}

// Extract new repos from GH Archive events - dedupe on the fly
export function extractReposFromEvents(events: GHArchiveEvent[]): Array<{ owner: string; repo: string }> {
  const seen = new Set<string>()
  const result: Array<{ owner: string; repo: string }> = []
  
  for (const event of events) {
    if (event.repo?.name && !seen.has(event.repo.name)) {
      seen.add(event.repo.name)
      const [owner, repo] = event.repo.name.split('/')
      if (owner && repo) {
        result.push({ owner, repo })
      }
    }
  }
  
  return result
}

// ============ GITHUB API (for scanning files) ============

interface GitHubResponse<T> {
  data: T | null
  error: string | null
  rateLimited: boolean
  remaining: number
}

async function githubFetch<T>(
  endpoint: string,
  options: { method?: string; body?: object } = {}
): Promise<GitHubResponse<T>> {
  const token = tokenPool.getToken()
  
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'KeyScan/1.0',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  try {
    const res = await fetch(`https://api.github.com${endpoint}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
    
    const remaining = parseInt(res.headers.get('x-ratelimit-remaining') || '0')
    const resetAt = parseInt(res.headers.get('x-ratelimit-reset') || '0') * 1000
    
    if (res.status === 403 || res.status === 429) {
      if (token) tokenPool.markRateLimited(token, resetAt)
      return { data: null, error: 'Rate limited', rateLimited: true, remaining: 0 }
    }
    
    if (res.status === 304) {
      return { data: null, error: null, rateLimited: false, remaining }
    }
    
    if (token) tokenPool.markUsed(token)
    
    if (!res.ok) {
      return { data: null, error: `HTTP ${res.status}`, rateLimited: false, remaining }
    }
    
    const data = await res.json()
    return { data, error: null, rateLimited: false, remaining }
  } catch (err) {
    return { data: null, error: String(err), rateLimited: false, remaining: 0 }
  }
}

// Get repository contents
export interface RepoContent {
  name: string
  path: string
  type: 'file' | 'dir' | 'symlink'
  download_url: string | null
  html_url: string
}

export async function getRepoContents(
  owner: string,
  repo: string,
  path: string = ''
): Promise<GitHubResponse<RepoContent[]>> {
  return githubFetch<RepoContent[]>(`/repos/${owner}/${repo}/contents/${path}`)
}

// Get file content
export async function getFileContent(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return res.text()
  } catch {
    return null
  }
}
