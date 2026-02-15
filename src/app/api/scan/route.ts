import { NextRequest, NextResponse } from 'next/server'
import { 
  startScanner, 
  stopScanner, 
  startDiscovery, 
  stopDiscovery, 
  getState, 
  addToQueue 
} from '@/lib/scanner'
import { tokenPool } from '@/lib/github'

export async function GET() {
  const state = getState()
  const tokenStatus = tokenPool.getStatus()
  
  return NextResponse.json({
    ...state,
    tokens: tokenStatus,
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const action = body.action
  
  switch (action) {
    case 'start':
      await tokenPool.initialize()
      startScanner()
      startDiscovery()
      return NextResponse.json({ status: 'started', state: getState() })
    
    case 'stop':
      stopScanner()
      stopDiscovery()
      return NextResponse.json({ status: 'stopped', state: getState() })
    
    case 'add':
      const { owner, repo } = body
      if (owner && repo) {
        addToQueue(owner, repo)
        return NextResponse.json({ status: 'added', queue: getState().queueSize })
      }
      return NextResponse.json({ error: 'Missing owner or repo' }, { status: 400 })
    
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
}
