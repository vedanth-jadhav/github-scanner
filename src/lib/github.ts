import { db } from './db'

interface TokenInfo {
  token: string
  usage: number
  lastUsed: number
  rateLimited: boolean
  resetAt: number
}

class TokenPool {
  private tokens: TokenInfo[] = []
  private currentIndex = 0
  
  async initialize() {
    const storedTokens = await db.token.findMany({
      where: { active: true },
      orderBy: { usage: 'asc' },
    })
    
    if (storedTokens.length === 0) {
      // Try environment variable
      const envTokens = process.env.GITHUB_TOKENS?.split(',').map(t => t.trim()).filter(Boolean) || []
      for (const token of envTokens) {
        await this.addToken(token)
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
  }
  
  async addToken(token: string, name?: string) {
    // Verify token works
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
  
  getToken(): string | null {
    if (this.tokens.length === 0) return null
    
    // Find best token (least used, not rate limited)
    const now = Date.now()
    const available = this.tokens.filter(t => !t.rateLimited || t.resetAt < now)
    
    if (available.length === 0) {
      // All rate limited, return null
      return null
    }
    
    // Sort by usage ascending
    available.sort((a, b) => a.usage - b.usage)
    const selected = available[0]
    
    return selected.token
  }
  
  markUsed(token: string) {
    const t = this.tokens.find(x => x.token === token)
    if (t) {
      t.usage++
      t.lastUsed = Date.now()
      
      // Update DB async
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
  
  getStatus() {
    return {
      total: this.tokens.length,
      available: this.tokens.filter(t => !t.rateLimited || t.resetAt < Date.now()).length,
      rateLimited: this.tokens.filter(t => t.rateLimited && t.resetAt >= Date.now()).length,
    }
  }
}

export const tokenPool = new TokenPool()

// GitHub API client
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
  if (!token) {
    return { data: null, error: 'No tokens available', rateLimited: true, remaining: 0 }
  }
  
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
      tokenPool.markRateLimited(token, resetAt)
      return { data: null, error: 'Rate limited', rateLimited: true, remaining: 0 }
    }
    
    if (res.status === 304) {
      // Not modified (ETag cache hit)
      return { data: null, error: null, rateLimited: false, remaining }
    }
    
    tokenPool.markUsed(token)
    
    if (!res.ok) {
      return { data: null, error: `HTTP ${res.status}`, rateLimited: false, remaining }
    }
    
    const data = await res.json()
    return { data, error: null, rateLimited: false, remaining }
  } catch (err) {
    return { data: null, error: String(err), rateLimited: false, remaining: 0 }
  }
}

// Get newest public repositories
export interface Repo {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  html_url: string
  description: string | null
  created_at: string
  pushed_at: string
  size: number
}

export async function getNewestRepos(since?: number): Promise<GitHubResponse<Repo[]>> {
  const params = since ? `?since=${since}` : ''
  return githubFetch<Repo[]>(`/repositories${params}`)
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

// Get repository archive (tarball)
export async function getRepoArchive(owner: string, repo: string): Promise<ReadableStream | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/tarball`, {
      headers: {
        Accept: 'application/vnd.github.v3.raw',
      },
    })
    if (!res.ok) return null
    return res.body
  } catch {
    return null
  }
}

// Get GitHub Events (for real-time repo discovery)
export interface Event {
  id: string
  type: string
  repo: { id: number; name: string; url: string }
  created_at: string
  actor: { login: string }
}

export async function getPublicEvents(etag?: string): Promise<{
  events: Event[]
  newEtag: string | null
  pollInterval: number
}> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  
  if (etag) {
    headers['If-None-Match'] = etag
  }
  
  const token = tokenPool.getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  try {
    const res = await fetch('https://api.github.com/events', { headers })
    
    const newEtag = res.headers.get('etag')
    const pollInterval = parseInt(res.headers.get('x-poll-interval') || '60')
    
    if (res.status === 304) {
      // Not modified
      if (token) tokenPool.markUsed(token)
      return { events: [], newEtag: null, pollInterval }
    }
    
    if (!res.ok) {
      return { events: [], newEtag: null, pollInterval }
    }
    
    if (token) tokenPool.markUsed(token)
    const events = await res.json()
    return { events, newEtag, pollInterval }
  } catch {
    return { events: [], newEtag: null, pollInterval: 60 }
  }
}
