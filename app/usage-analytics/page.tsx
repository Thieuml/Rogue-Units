'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
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

export default function UsageAnalyticsPage() {
  const { data: session, status } = useSession()
  const [data, setData] = useState<UsageAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

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
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 text-white flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <WeMaintainLogo />
        </div>
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            <a
              href="/"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white font-medium hover:bg-slate-700 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>New Diagnostic</span>
            </a>
            <a
              href="/prompt-testing"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-white font-medium hover:bg-slate-700 transition-colors"
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
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm bg-slate-700 text-white font-medium"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 16L12 11L16 15L21 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Usage Analytics</span>
            </a>
          </div>
        </nav>
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
              <div className="flex items-center gap-2 text-red-700">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 8V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-semibold">Error loading analytics</span>
              </div>
              <p className="text-sm text-red-600 mt-2">{error}</p>
              <button
                onClick={fetchAnalytics}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
              >
                Retry
              </button>
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

              {/* User Statistics Table */}
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
                          <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                            {searchTerm ? 'No users found matching your search' : 'No diagnostics data available'}
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
            </>
          )}
        </div>
      </main>
    </div>
  )
}

