import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}

