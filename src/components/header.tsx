'use client'

interface HeaderProps {
  running: boolean
  onStart: () => void
  onStop: () => void
  onSettings: () => void
}

export function Header({ running, onStart, onStop, onSettings }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border">
      <h1 className="text-lg font-medium tracking-tight">KEYSCAN</h1>
      
      <div className="flex items-center gap-2">
        {running ? (
          <button
            onClick={onStop}
            className="px-3 py-1.5 text-sm bg-bg-tertiary hover:bg-border rounded transition-colors"
          >
            ■ Stop
          </button>
        ) : (
          <button
            onClick={onStart}
            className="px-3 py-1.5 text-sm bg-provider-openai/20 text-provider-openai hover:bg-provider-openai/30 rounded transition-colors"
          >
            ▶ Start
          </button>
        )}
        
        <button
          onClick={onSettings}
          className="px-3 py-1.5 text-sm bg-bg-tertiary hover:bg-border rounded transition-colors"
        >
          ⚙
        </button>
      </div>
    </header>
  )
}
