import type { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { SessionProvider } from '@/components/SessionProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Rogue Units Analysis - Lift Diagnostic System',
  description: 'Generate instant diagnostic summaries for lifts',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // TEMPORARY: Bypass SSO if BYPASS_SSO env var is set to 'true'
  // Remove this bypass once Google Workspace SSO is configured
  const BYPASS_SSO = process.env.BYPASS_SSO === 'true'
  const session = BYPASS_SSO ? null : await getServerSession(authOptions)
  
  return (
    <html lang="en">
      <body>
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}

