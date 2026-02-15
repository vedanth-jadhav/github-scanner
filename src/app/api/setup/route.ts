import { NextResponse } from 'next/server'
import { createClient } from '@libsql/client'

export async function GET() {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const tursoToken = process.env.TURSO_AUTH_TOKEN
  
  if (!tursoUrl || !tursoToken) {
    return NextResponse.json({ 
      error: 'Turso credentials not configured',
      hasTurso: false 
    })
  }
  
  const db = createClient({
    url: tursoUrl,
    authToken: tursoToken,
  })
  
  try {
    // Create tables if they don't exist
    await db.execute(`
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
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "ScannedRepo" (
        "id" TEXT PRIMARY KEY,
        "owner" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "fullName" TEXT UNIQUE NOT NULL,
        "scannedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "findings" INTEGER DEFAULT 0
      )
    `)
    
    await db.execute(`
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
    
    await db.execute(`
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
    
    return NextResponse.json({ 
      success: true, 
      message: 'Tables created successfully',
      hasTurso: true 
    })
  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({ 
      error: String(error),
      hasTurso: true 
    }, { status: 500 })
  }
}
