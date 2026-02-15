import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getPrismaClient() {
  const dbUrl = process.env.DATABASE_URL
  
  if (!dbUrl) {
    console.log('No DATABASE_URL, using local SQLite')
    return new PrismaClient({
      datasources: { db: { url: 'file:./prisma/dev.db' } }
    })
  }
  
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    console.log('Using PostgreSQL')
    return new PrismaClient({
      datasources: { db: { url: dbUrl } }
    })
  }
  
  if (dbUrl.startsWith('file:') || dbUrl.startsWith('sqlite:')) {
    console.log('Using local SQLite:', dbUrl)
    return new PrismaClient({
      datasources: { db: { url: dbUrl } }
    })
  }
  
  if (dbUrl.startsWith('libsql://') || dbUrl.startsWith('http')) {
    console.log('Using Turso/libsql:', dbUrl)
    const libsql = createClient({
      url: dbUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter })
  }
  
  return new PrismaClient({ datasources: { db: { url: dbUrl } } })
}

export const db = globalForPrisma.prisma ?? getPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}