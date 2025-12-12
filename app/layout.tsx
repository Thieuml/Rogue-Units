import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from '@/components/SessionProvider'

export const metadata: Metadata = {
  title: 'Rogue Units Analysis - Lift Diagnostic System',
  description: 'Generate instant diagnostic summaries for lifts',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider session={null}>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}

