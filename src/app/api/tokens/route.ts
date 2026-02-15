import { NextRequest, NextResponse } from 'next/server'
import { tokenPool } from '@/lib/github'
import { db, ensureTables } from '@/lib/db'

export async function GET() {
  await ensureTables()
  const tokens = await db.token.findMany({
    select: {
      id: true,
      name: true,
      active: true,
      usage: true,
      createdAt: true,
    },
  })
  
  return NextResponse.json({ tokens })
}

export async function POST(request: NextRequest) {
  await ensureTables()
  const { token, name } = await request.json()
  
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }
  
  const success = await tokenPool.addToken(token, name)
  
  if (success) {
    return NextResponse.json({ status: 'added' })
  }
  
  return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
}

export async function DELETE(request: NextRequest) {
  await ensureTables()
  const { id } = await request.json()
  
  await db.token.update({
    where: { id },
    data: { active: false },
  })
  
  return NextResponse.json({ status: 'removed' })
}
