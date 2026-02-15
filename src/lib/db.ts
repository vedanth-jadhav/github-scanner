import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let initPromise: Promise<void> | null = null
let tablesReady = false
let autoStartDone = false

async function ensureTables() {
  if (initPromise) return initPromise
  
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const tursoToken = process.env.TURSO_AUTH_TOKEN
  
  if (!tursoUrl || !tursoToken) return
  
  initPromise = (async () => {
    console.log('Creating tables in Turso...')
    
    const client = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    })

    await client.execute(`
      CREATE TABLE IF NOT EXISTS "Finding" (
        "id" TEXT PRIMARY KEY,
        "provider" TEXT NOT NULL,
        "keyMasked" TEXT NOT NULL,
        "keyHash" TEXT UNIQUE NOT NULL,
        "repoOwner" TEXT NOT NULL,
        "repoName" TEXT NOT NULL,
        "filePath" TEXT NOT NULL,
        "line" INTEGER,
        "githubUrl" TEXT NOT NULL,
        "foundAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "disclosed" INTEGER DEFAULT 0,
        "disclosedAt" DATETIME
      )
    `)
    
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "ScannedRepo" (
        "id" TEXT PRIMARY KEY,
        "owner" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "fullName" TEXT UNIQUE NOT NULL,
        "scannedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "findings" INTEGER DEFAULT 0
      )
    `)
    
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "Token" (
        "id" TEXT PRIMARY KEY,
        "token" TEXT UNIQUE NOT NULL,
        "name" TEXT,
        "active" INTEGER DEFAULT 1,
        "usedAt" DATETIME,
        "usage" INTEGER DEFAULT 0,
        "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "ScanLog" (
        "id" TEXT PRIMARY KEY,
        "repoOwner" TEXT NOT NULL,
        "repoName" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "findings" INTEGER DEFAULT 0,
        "duration" INTEGER,
        "error" TEXT,
        "scannedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    console.log('Tables ready')
    tablesReady = true
    
    if (!autoStartDone) {
      autoStartDone = true
      autoStart()
    }
  })()
  
  return initPromise
}

async function autoStart() {
  console.log('Auto-starting scanner...')
  const { startScanner, startDiscovery } = await import('./scanner')
  const { tokenPool } = await import('./github')
  
  await tokenPool.initialize()
  startScanner()
  startDiscovery()
  console.log('Scanner auto-started')
}

function getPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const tursoToken = process.env.TURSO_AUTH_TOKEN
  const dbUrl = process.env.DATABASE_URL
  
  if (tursoUrl && tursoToken) {
    console.log('Using Turso:', tursoUrl)
    const libsql = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter })
  }
  
  if (!dbUrl) {
    console.log('Using local SQLite')
    return new PrismaClient({
      datasources: { db: { url: 'file:./prisma/dev.db' } }
    })
  }
  
  return new PrismaClient({
    datasources: { db: { url: dbUrl } }
  })
}

export const db = globalForPrisma.prisma ?? getPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

export { ensureTables }

export async function isTablesReady(): Promise<boolean> {
  if (tablesReady) return true
  await ensureTables()
  return tablesReady
}