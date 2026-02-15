import { NextRequest, NextResponse } from 'next/server'
import { db, ensureTables } from '@/lib/db'

export async function GET(request: NextRequest) {
  await ensureTables()
  const { searchParams } = new URL(request.url)
  const provider = searchParams.get('provider')
  const limit = parseInt(searchParams.get('limit') || '100')
  const offset = parseInt(searchParams.get('offset') || '0')
  
  const where = provider ? { provider } : {}
  
  const findings = await db.finding.findMany({
    where,
    orderBy: { foundAt: 'desc' },
    take: limit,
    skip: offset,
  })
  
  const total = await db.finding.count({ where })
  
  return NextResponse.json({
    findings: findings.map(f => ({
      ...f,
      foundAt: f.foundAt.toISOString(),
      disclosedAt: f.disclosedAt?.toISOString() || null,
    })),
    total,
    hasMore: offset + findings.length < total,
  })
}

export async function DELETE(request: NextRequest) {
  await ensureTables()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }
  
  await db.finding.delete({ where: { id } })
  
  return NextResponse.json({ status: 'deleted' })
}
