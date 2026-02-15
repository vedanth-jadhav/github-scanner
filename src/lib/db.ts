import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const tursoToken = process.env.TURSO_AUTH_TOKEN
  const dbUrl = process.env.DATABASE_URL
  
  if (tursoUrl) {
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
  
  if (dbUrl.startsWith('file:') || dbUrl.startsWith('sqlite:')) {
    console.log('Using local SQLite:', dbUrl)
    return new PrismaClient({
      datasources: { db: { url: dbUrl } }
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