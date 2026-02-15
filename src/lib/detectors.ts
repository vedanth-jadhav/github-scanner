import AhoCorasick from 'modern-ahocorasick'

// Provider configurations with accurate patterns
export const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    color: '#10a37f',
    keywords: ['sk-proj-', 'sk-'],
    pattern: /sk-proj-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{48,}/g,
    minLength: 20,
    prefix: 'sk-',
  },
  anthropic: {
    name: 'Anthropic',
    color: '#d4a574',
    keywords: ['sk-ant-'],
    pattern: /sk-ant-api03-[A-Za-z0-9_-]{80,}/g,
    minLength: 90,
    prefix: 'sk-ant-',
  },
  gemini: {
    name: 'Gemini',
    color: '#4285f4',
    keywords: ['AIza'],
    pattern: /AIza[A-Za-z0-9_-]{35}/g,
    minLength: 39,
    prefix: 'AIza',
  },
  groq: {
    name: 'Groq',
    color: '#f55036',
    keywords: ['gsk_'],
    pattern: /gsk_[A-Za-z0-9]{52}/g,
    minLength: 56,
    prefix: 'gsk_',
  },
  cerebras: {
    name: 'Cerebras',
    color: '#8b5cf6',
    keywords: ['csk-'],
    pattern: /csk-[A-Za-z0-9]{32,}/g,
    minLength: 36,
    prefix: 'csk-',
  },
  openrouter: {
    name: 'OpenRouter',
    color: '#6366f1',
    keywords: ['sk-or-'],
    pattern: /sk-or-[A-Za-z0-9_-]{20,}/g,
    minLength: 26,
    prefix: 'sk-or-',
  },
  grok: {
    name: 'Grok (xAI)',
    color: '#1da1f2',
    keywords: ['xai-'],
    pattern: /xai-[A-Za-z0-9]{20,}/g,
    minLength: 24,
    prefix: 'xai-',
  },
} as const

export type ProviderKey = keyof typeof PROVIDERS

// Build Aho-Corasick automaton with all keywords
const allKeywords: string[] = []
Object.values(PROVIDERS).forEach(p => allKeywords.push(...p.keywords))
const ac = new AhoCorasick(allKeywords)

// Banlist patterns for false positive filtering
const BANLIST_PATTERNS = [
  // Placeholder keywords
  /(your|my|the|replace|placeholder|example|test|sample|dummy|fake|xxx+)_?(key|token|secret)/i,
  /^(sk-)?(test|example|demo|sample)/i,
  /^sk-ant-(test|example|demo)/i,
  
  // Repeated characters
  /(.)\1{5,}/,
  
  // Sequential patterns
  /(abc|123|xyz|qwerty|asdf)/i,
  
  // Known example keys from documentation
  /sk-proj-abcdefghijklmnop/i,
  /sk-ant-api03-xxxxxxxx/i,
  /AIzaSy[A-Za-z0-9_-]{33}example/i,
  
  // Variable assignment patterns
  /(API_KEY|SECRET|TOKEN)\s*[=:]\s*["'](?:xxx+|your_key|changeme)/i,
]

// File patterns to skip
export const SKIP_FILE_PATTERNS = [
  /node_modules/i,
  /vendor/i,
  /\.min\.(js|css)$/i,
  /package-lock\.json$/i,
  /yarn\.lock$/i,
  /pnpm-lock\.yaml$/i,
  /\.d\.ts$/i,
  /dist\//i,
  /build\//i,
  /\.next\//i,
  /__pycache__/i,
  /\.git\//i,
]

// Extensions to scan
export const SCAN_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.java', '.kt', '.rs',
  '.env', '.env.local', '.env.development', '.env.production',
  '.yaml', '.yml', '.json', '.toml', '.ini', '.conf', '.cfg',
  '.sh', '.bash', '.zsh', '.fish',
  '.md', '.txt', '.example', '.sample',
])

// Calculate Shannon entropy
export function calculateEntropy(str: string): number {
  const freq: Record<string, number> = {}
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1
  }
  
  let entropy = 0
  const len = str.length
  for (const count of Object.values(freq)) {
    const p = count / len
    entropy -= p * Math.log2(p)
  }
  return entropy
}

// Check if key matches banlist
function matchesBanlist(key: string): boolean {
  for (const pattern of BANLIST_PATTERNS) {
    if (pattern.test(key)) return true
  }
  return false
}

// Mask key for display
export function maskKey(key: string): string {
  if (key.length <= 12) return '****'
  const start = key.slice(0, 8)
  const end = key.slice(-4)
  return `${start}****...****${end}`
}

// Hash key for deduplication
export async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Pre-flight check using Aho-Corasick
export function preflightCheck(content: string): boolean {
  const matches = ac.search(content)
  return matches.length > 0
}

// Detect all keys in content
export interface Detection {
  provider: ProviderKey
  key: string
  keyMasked: string
  keyHash: string
  line?: number
  entropy: number
  confidence: number
}

export async function detectKeys(
  content: string,
  filePath: string
): Promise<Detection[]> {
  const findings: Detection[] = []
  
  // Pre-flight check
  if (!preflightCheck(content)) return findings
  
  // Skip banlist files
  for (const pattern of SKIP_FILE_PATTERNS) {
    if (pattern.test(filePath)) return findings
  }
  
  // Process each provider
  for (const [providerKey, provider] of Object.entries(PROVIDERS)) {
    const matches = Array.from(content.matchAll(provider.pattern))
    
    for (const match of matches) {
      const key = match[0]
      
      // Length check
      if (key.length < provider.minLength) continue
      
      // Banlist check
      if (matchesBanlist(key)) continue
      
      // Entropy check
      const entropy = calculateEntropy(key)
      if (entropy < 3.0) continue
      
      // Calculate confidence score
      let confidence = 0
      if (entropy >= 4.0) confidence += 30
      else if (entropy >= 3.0) confidence += 15
      if (/[A-Z]/.test(key) && /[a-z]/.test(key)) confidence += 20
      if (/[0-9]/.test(key)) confidence += 10
      if (provider.prefix && key.startsWith(provider.prefix)) confidence += 25
      confidence += 15 // Passed all filters
      
      // Find line number
      const line = content.substring(0, match.index || 0).split('\n').length
      
      findings.push({
        provider: providerKey as ProviderKey,
        key,
        keyMasked: maskKey(key),
        keyHash: await hashKey(key),
        line,
        entropy,
        confidence: Math.min(confidence, 100),
      })
    }
  }
  
  return findings
}
