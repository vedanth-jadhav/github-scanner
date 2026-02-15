import { NextRequest, NextResponse } from 'next/server'
import { tokenPool } from '@/lib/github'
import { db } from '@/lib/db'

export async function GET() {
  const tokens = await db.token.findMany({
    select: {
      id: true,
      name: true,
      active: true,
      usage: true,
      createdAt: true,
      // Don't expose the actual token
    },
  })
  
  return NextResponse.json({ tokens })
}

export async function POST(request: NextRequest) {
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
  const { id } = await request.json()
  
  await db.token.update({
    where: { id },
    data: { active: false },
  })
  
  return NextResponse.json({ status: 'removed' })
}
