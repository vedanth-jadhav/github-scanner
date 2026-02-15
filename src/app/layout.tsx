import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'KeyScan',
  description: 'GitHub API Key Scanner',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg-primary">{children}</body>
    </html>
  )
}
