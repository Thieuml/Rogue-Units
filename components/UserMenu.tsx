'use client'

import { signOut, useSession } from "next-auth/react"

export function UserMenu() {
  const { data: session, status } = useSession()
  
  // TEMPORARY: Show bypass indicator if SSO is bypassed
  // Remove this once Google Workspace SSO is configured
  const BYPASS_SSO = process.env.NEXT_PUBLIC_BYPASS_SSO === 'true'
  
  if (BYPASS_SSO) {
    return (
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
            <span className="text-white font-semibold">D</span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">Dev Mode</div>
            <div className="text-xs text-slate-400">SSO Bypassed</div>
          </div>
        </div>
      </div>
    )
  }
  
  // Show loading state while checking session
  if (status === 'loading') {
    return (
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center animate-pulse">
            <span className="text-white font-semibold">...</span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">Loading...</div>
          </div>
        </div>
      </div>
    )
  }
  
  // If not authenticated, show sign-in prompt
  if (!session) {
    return (
      <div className="p-4 border-t border-slate-700">
        <a
          href="/auth/signin"
          className="w-full text-sm text-white hover:text-blue-400 px-3 py-2 rounded hover:bg-slate-700 transition-colors text-center block"
        >
          Sign In
        </a>
      </div>
    )
  }
  
  // Extract first letter of name or email for avatar
  const displayName = session.user?.name || session.user?.email || 'U'
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || displayName[0].toUpperCase()
  
  return (
    <div className="p-4 border-t border-slate-700">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-semibold text-sm">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            {session.user?.name || 'User'}
          </div>
          <div className="text-xs text-slate-400 truncate">
            {session.user?.email}
          </div>
        </div>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: '/auth/signin' })}
        className="w-full text-sm text-white hover:text-red-400 px-3 py-2 rounded hover:bg-slate-700 transition-colors text-center"
      >
        Sign Out
      </button>
    </div>
  )
}

