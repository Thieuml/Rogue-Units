'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { WeMaintainLogo } from '@/components/WeMaintainLogo'
import { UserMenu } from '@/components/UserMenu'

interface UserStat {
  userId: string
  userName: string
  totalDiagnostics: number
  latestDiagnosticDate: string
  countries: string[]
}

interface OverallStats {
  totalUsers: number
  totalDiagnostics: number
  averageDiagnosticsPerUser: string
}

interface UsageAnalyticsData {
  userStats: UserStat[]
  overallStats: OverallStats
}

const COUNTRIES = [
  { code: 'FR', name: 'France' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
]

export default function UsageAnalyticsPage() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [data, setData] = useState<UsageAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Optimistic admin check - remember if user was admin to prevent flickering
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  
  // Initialize from localStorage FIRST for instant render (no flicker)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('isAdmin')
      if (stored === 'true') {
        setIsAdmin(true)
      }
    }
  }, [])
  
  useEffect(() => {
    if (session?.user?.email) {
      const adminEmails = ['matthieu@wemaintain.com', 'marine@wemaintain.com', 'georgia@wemaintain.com']
      const adminStatus = adminEmails.includes(session.user.email)
      setIsAdmin(adminStatus)
      // Store in localStorage for persistence across page loads
      if (typeof window !== 'undefined') {
        localStorage.setItem('isAdmin', String(adminStatus))
      }
    }
    // Note: We DON'T set isAdmin to false if session is undefined
    // This prevents flickering during navigation when session is temporarily unavailable
  }, [session?.user?.email])
  
  // Initialize country from localStorage or default to FR
  const [country, setCountryState] = useState<string>('FR')
  
  // Load saved country from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('diagnostic-country')
      if (saved && saved !== country) {
        setCountryState(saved)
      }
    }
  }, [])
  
  // Wrapper to also save to localStorage
  const setCountry = (newCountry: string) => {
    setCountryState(newCountry)
    if (typeof window !== 'undefined') {
      localStorage.setItem('diagnostic-country', newCountry)
    }
  }
  
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAnalytics()
    }
  }, [status])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/usage-analytics')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`)
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      console.error('[Usage Analytics] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const filteredStats = data?.userStats.filter(stat =>
    stat.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stat.userId.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 text-white flex flex-col h-screen flex-shrink-0">
        <div className="p-6 border-b border-slate-700">
          <WeMaintainLogo />
        </div>
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-2">
            {/* Country Selection - Above Navigation */}
            <div className="mb-4">
              <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Country
              </div>
              <div className="relative">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowCountryDropdown(!showCountryDropdown)
                  }}
                  className="w-full text-left px-3 py-2 rounded-md text-sm font-medium bg-slate-700 text-white hover:bg-slate-600 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>
                    {COUNTRIES.find(c => c.code === country)?.name} ({country})
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showCountryDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-700 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    {COUNTRIES.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setCountry(c.code)
                          setShowCountryDropdown(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                          country === c.code
                            ? 'bg-slate-600 text-white'
                            : 'text-slate-300 hover:bg-slate-600 hover:text-white'
                        }`}
                      >
                        {c.name} ({c.code})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Navigation
            </div>
            <a
              href="/"
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white font-medium cursor-pointer transition-colors ${
                pathname === '/' ? 'bg-slate-700' : 'hover:bg-slate-700'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                <path fillRule="evenodd" clipRule="evenodd" d="M15.7692 1.85001L19.65 5.73077V20C19.65 21.1358 18.7693 22.0659 17.6535 22.1446L17.5 22.15H6.49998C5.36419 22.15 4.4341 21.2693 4.35537 20.1535L4.34998 20V4.00001C4.34998 2.86422 5.23068 1.93413 6.34643 1.8554L6.49998 1.85001H15.7692ZM14.549 3.15001H6.49998C6.06664 3.15001 5.70905 3.47427 5.6566 3.89338L5.64998 4.00001V20C5.64998 20.4333 5.97424 20.7909 6.39335 20.8434L6.49998 20.85H17.5C17.9333 20.85 18.2909 20.5257 18.3434 20.1066L18.35 20L18.349 7.15001H16.2C15.3367 7.15001 14.6282 6.48699 14.556 5.64237L14.55 5.50001L14.549 3.15001ZM15.849 3.76901L15.85 5.50001C15.85 5.66914 15.9699 5.81026 16.1294 5.8429L16.2 5.85001H17.93L15.849 3.76901Z" fill="currentColor"/>
                <path d="M10.2 10H14.64C14.8388 10 15 10.1612 15 10.36V14.8M13.8 11.2L9 16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <span>Launch New Diagnostic</span>
            </a>
            <a
              href="/?view=recent"
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white font-medium cursor-pointer transition-colors hover:bg-slate-700`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                <path fillRule="evenodd" clipRule="evenodd" d="M15 2.20001C15.6351 2.20001 16.15 2.71488 16.15 3.35001L16.149 4.00001H18C18.8633 4.00001 19.5718 4.66303 19.6439 5.50764L19.65 5.65001V20.65C19.65 21.5133 18.987 22.2218 18.1424 22.294L18 22.3H6.00001C5.1367 22.3 4.42825 21.637 4.35606 20.7924L4.35001 20.65V5.65001C4.35001 4.7867 5.01302 4.07825 5.85764 4.00607L6.00001 4.00001H7.85001V3.35001C7.85001 2.75723 8.29852 2.2692 8.8747 2.20676L9.00001 2.20001H15ZM16.15 5.85001C16.15 6.48514 15.6351 7.00001 15 7.00001H9.00001C8.36488 7.00001 7.85001 6.48514 7.85001 5.85001V5.30001H6.00001C5.83087 5.30001 5.68975 5.41999 5.65712 5.57948L5.65001 5.65001V20.65C5.65001 20.8191 5.76998 20.9603 5.92947 20.9929L6.00001 21H18C18.1691 21 18.3103 20.88 18.3429 20.7205L18.35 20.65V5.65001C18.35 5.48088 18.23 5.33976 18.0705 5.30712L18 5.30001H16.149L16.15 5.85001ZM8.25001 16.3C8.66422 16.3 9.00001 16.6358 9.00001 17.05C9.00001 17.4642 8.66422 17.8 8.25001 17.8C7.83579 17.8 7.50001 17.4642 7.50001 17.05C7.50001 16.6358 7.83579 16.3 8.25001 16.3ZM16 16.4C16.359 16.4 16.65 16.691 16.65 17.05C16.65 17.3764 16.4095 17.6465 16.0961 17.693L16 17.7H11C10.641 17.7 10.35 17.409 10.35 17.05C10.35 16.7237 10.5905 16.4535 10.904 16.4071L11 16.4H16ZM8.25001 12.825C8.66422 12.825 9.00001 13.1608 9.00001 13.575C9.00001 13.9892 8.66422 14.325 8.25001 14.325C7.83579 14.325 7.50001 13.9892 7.50001 13.575C7.50001 13.1608 7.83579 12.825 8.25001 12.825ZM16 12.925C16.359 12.925 16.65 13.216 16.65 13.575C16.65 13.9014 16.4095 14.1715 16.0961 14.218L16 14.225H11C10.641 14.225 10.35 13.934 10.35 13.575C10.35 13.2487 10.5905 12.9785 10.904 12.9321L11 12.925H16ZM8.25001 9.35001C8.66422 9.35001 9.00001 9.6858 9.00001 10.1C9.00001 10.5142 8.66422 10.85 8.25001 10.85C7.83579 10.85 7.50001 10.5142 7.50001 10.1C7.50001 9.6858 7.83579 9.35001 8.25001 9.35001ZM16 9.45001C16.359 9.45001 16.65 9.74103 16.65 10.1C16.65 10.4264 16.4095 10.6965 16.0961 10.743L16 10.75H11C10.641 10.75 10.35 10.459 10.35 10.1C10.35 9.77366 10.5905 9.50349 10.904 9.45706L11 9.45001H16ZM14.85 3.50001H9.15001V5.70001H14.85V3.50001Z" fill="currentColor"/>
              </svg>
              <span>Recent Diagnostics</span>
            </a>
          </div>
          
          {/* Admin Tools Section - Only visible to admin users */}
          {isAdmin && (
            <div className="pb-4 mt-4">
              <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Admin</div>
              <div className="space-y-2">
                <a
                  href="/prompt-testing"
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white font-medium cursor-pointer transition-colors ${
                    pathname === '/prompt-testing' ? 'bg-slate-700' : 'hover:bg-slate-700'
                  }`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                    <path fillRule="evenodd" clipRule="evenodd" d="M6.41792 13.8132C6.53697 13.8986 6.67554 13.9585 6.82564 13.9849C6.88226 13.9948 6.94052 14 6.99998 14C7.24814 14 7.47518 13.9096 7.64998 13.76V13.76C7.86423 13.5766 8.00001 13.3042 8.00001 13C8.00001 12.6959 7.86423 12.4234 7.64998 12.24V12.24C7.62813 12.2213 7.60546 12.2035 7.58204 12.1868C7.46563 12.1033 7.33057 12.0442 7.18431 12.017C7.12457 12.0058 7.06297 12 7.00001 12C6.44773 12 6.00001 12.4477 6.00001 13C6.00001 13.3351 6.16487 13.6318 6.41792 13.8132ZM6.34998 10.7932C5.39627 11.0736 4.70001 11.9555 4.70001 13C4.70001 14.0445 5.39627 14.9264 6.34998 15.2069L6.34998 20C6.34998 20.359 6.64099 20.65 6.99998 20.65C7.35896 20.65 7.64998 20.359 7.64998 20L7.64998 15.2069C8.60372 14.9264 9.30001 14.0445 9.30001 13C9.30001 11.9555 8.60372 11.0736 7.64998 10.7931L7.64998 4.00001C7.64998 3.64102 7.35896 3.35001 6.99998 3.35001C6.64099 3.35001 6.34998 3.64102 6.34998 4.00001L6.34998 10.7932Z" fill="currentColor"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M16.4179 16.8132C16.5351 16.8972 16.6711 16.9566 16.8185 16.9836C16.8774 16.9944 16.938 17 17 17C17.2481 17 17.4752 16.9096 17.65 16.76V16.76C17.8642 16.5766 18 16.3042 18 16C18 15.6959 17.8642 15.4234 17.65 15.24V15.24C17.6281 15.2213 17.6055 15.2035 17.582 15.1868C17.4656 15.1033 17.3305 15.0442 17.1842 15.0169C17.1245 15.0058 17.0629 15 17 15C16.4477 15 16 15.4477 16 16C16 16.3351 16.1649 16.6318 16.4179 16.8132ZM16.35 13.7932C15.3963 14.0736 14.7 14.9555 14.7 16C14.7 17.0445 15.3963 17.9264 16.35 18.2069L16.35 20C16.35 20.359 16.641 20.65 17 20.65C17.359 20.65 17.65 20.359 17.65 20L17.65 18.2069C18.6037 17.9264 19.3 17.0445 19.3 16C19.3 14.9555 18.6037 14.0736 17.65 13.7931L17.65 4.00001C17.65 3.64102 17.359 3.35001 17 3.35001C16.641 3.35001 16.35 3.64102 16.35 4.00001L16.35 13.7932Z" fill="currentColor"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.4904 8.86059C11.5549 8.89885 11.624 8.93007 11.6967 8.95319C11.7924 8.9836 11.8943 9 12 9C12.2481 9 12.4752 8.90961 12.65 8.75997V8.76C12.8642 8.57659 13 8.30416 13 8.00001C13 7.69586 12.8642 7.42343 12.65 7.24002V7.24003C12.5844 7.18392 12.5115 7.13613 12.4329 7.09832C12.4054 7.0851 12.3773 7.07311 12.3485 7.0624C12.24 7.02205 12.1226 7.00001 12 7.00001C11.4477 7.00001 11 7.44773 11 8.00001C11 8.36617 11.1968 8.68636 11.4904 8.86059ZM11.35 5.79316C10.3963 6.07363 9.70001 6.95551 9.70001 8.00001C9.70001 9.04452 10.3963 9.9264 11.35 10.2069L11.35 20C11.35 20.359 11.641 20.65 12 20.65C12.359 20.65 12.65 20.359 12.65 20L12.65 10.2069C13.6037 9.92644 14.3 9.04454 14.3 8.00001C14.3 6.95548 13.6037 6.07358 12.65 5.79313L12.65 4.00001C12.65 3.64102 12.359 3.35001 12 3.35001C11.641 3.35001 11.35 3.64102 11.35 4.00001L11.35 5.79316Z" fill="currentColor"/>
                  </svg>
                  <span>Prompt Testing</span>
                </a>
                <a
                  href="/usage-analytics"
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white font-medium cursor-pointer transition-colors ${
                    pathname === '/usage-analytics' ? 'bg-slate-700' : 'hover:bg-slate-700'
                  }`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                    <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M7 16L12 11L16 15L21 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Usage Analytics</span>
                </a>
              </div>
            </div>
          )}
        </nav>
        {/* User Menu at Bottom */}
        <UserMenu />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-gray-900">Usage Analytics</h1>

          {(status === 'loading' || loading) && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading analytics...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-red-900 mb-1">Unable to load analytics</h3>
                  <p className="text-sm text-red-700 mb-3">
                    {error.includes('table') || error.includes('database') 
                      ? 'The database may not be properly initialized. Please contact support if this persists.' 
                      : error}
                  </p>
                  <button
                    onClick={fetchAnalytics}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}

          {data && !loading && status === 'authenticated' && (
            <>
              {/* Overall Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Users</p>
                      <p className="text-3xl font-bold text-gray-900">{data.overallStats.totalUsers}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-600">
                        <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Diagnostics</p>
                      <p className="text-3xl font-bold text-gray-900">{data.overallStats.totalDiagnostics}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-green-600">
                        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M10 9H9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Avg. per User</p>
                      <p className="text-3xl font-bold text-gray-900">{data.overallStats.averageDiagnosticsPerUser}</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-purple-600">
                        <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7 16L12 11L16 15L21 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Show info message when there's no data at all */}
              {data.userStats.length === 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 mb-6">
                  <div className="flex items-start gap-4">
                    <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h3 className="text-base font-semibold text-blue-900 mb-1">No usage data yet</h3>
                      <p className="text-sm text-blue-700 mb-2">
                        Analytics will appear here once users start generating diagnostics.
                      </p>
                      <p className="text-sm text-blue-600">
                        To get started, navigate to the main page and launch your first diagnostic.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* User Statistics Table - only show if there's data */}
              {data.userStats.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">User Statistics</h2>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search users..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-64 px-4 py-2 pl-10 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <svg
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Countries
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Total Diagnostics
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Latest Diagnostic
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredStats.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12">
                            <div className="text-center">
                              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {searchTerm ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                )}
                              </svg>
                              <h3 className="text-sm font-medium text-gray-900 mb-1">
                                {searchTerm ? 'No users found' : 'No diagnostics yet'}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {searchTerm 
                                  ? 'Try adjusting your search term' 
                                  : 'Diagnostics will appear here once users start generating them'}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredStats.map((stat, idx) => (
                          <tr key={stat.userId} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                  <span className="text-sm font-semibold text-blue-600">
                                    {stat.userName.substring(0, 2).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{stat.userName}</p>
                                  <p className="text-xs text-gray-500">{stat.userId}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-1 flex-wrap">
                                {stat.countries.map(country => (
                                  <span
                                    key={country}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                                  >
                                    {country}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-lg">
                                <span className="text-lg font-bold text-blue-600">{stat.totalDiagnostics}</span>
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-400">
                                  <path fillRule="evenodd" clipRule="evenodd" d="M14.15 0C14.509 0 14.8 0.291015 14.8 0.65L14.799 1.5H16.65C18.1136 1.5 19.3 2.68645 19.3 4.15V17.15C19.3 18.6136 18.1136 19.8 16.65 19.8H2.65C1.18645 19.8 0 18.6136 0 17.15V4.15C0 2.68645 1.18645 1.5 2.65 1.5H4.5V0.65C4.5 0.291015 4.79102 0 5.15 0C5.50899 0 5.8 0.291015 5.8 0.65V1.5H13.5V0.65C13.5 0.291015 13.791 0 14.15 0ZM18 7.299H1.3V17.15C1.3 17.8956 1.90442 18.5 2.65 18.5H16.65C17.3956 18.5 18 17.8956 18 17.15V7.299Z" fill="currentColor"/>
                                </svg>
                                <span className="text-sm text-gray-700">{formatDate(stat.latestDiagnosticDate)}</span>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredStats.length > 0 && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      Showing {filteredStats.length} of {data.userStats.length} user{data.userStats.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

