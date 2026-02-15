import { NextRequest } from 'next/server'
import { on, getState } from '@/lib/scanner'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }
      
      // Send initial state
      sendEvent('status', getState())
      
      // Subscribe to scanner events
      const unsubStatus = on('status', (data) => sendEvent('status', data))
      const unsubFinding = on('finding', (data) => sendEvent('finding', data))
      const unsubQueue = on('queue', (data) => sendEvent('queue', data))
      
      // Keep-alive ping every 15 seconds
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          // Client disconnected
          clearInterval(keepAlive)
          unsubStatus()
          unsubFinding()
          unsubQueue()
        }
      }, 15000)
      
      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive)
        unsubStatus()
        unsubFinding()
        unsubQueue()
        try {
          controller.close()
        } catch {}
      })
    },
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
