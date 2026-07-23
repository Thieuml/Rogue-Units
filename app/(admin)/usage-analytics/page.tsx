'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

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

type SortColumn = 'userName' | 'totalDiagnostics' | 'countries' | 'latestDiagnosticDate'
type SortDirection = 'asc' | 'desc'

export default function UsageAnalyticsPage() {
  const { data: session, status } = useSession()
  const [data, setData] = useState<UsageAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn>('latestDiagnosticDate')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

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
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to load analytics (${response.status})`)
      }
      
      const analyticsData = await response.json()
      setData(analyticsData)
    } catch (err) {
      console.error('Error loading analytics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Never'
    
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return 'Invalid date'
      
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    } catch {
      return 'Invalid date'
    }
  }

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection(column === 'userName' || column === 'countries' ? 'asc' : 'desc')
    }
  }

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }

    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

  const filteredUsers = data?.userStats.filter(stat =>
    stat.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stat.userId.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1

    switch (sortColumn) {
      case 'userName': {
        const comparison = a.userName.localeCompare(b.userName, undefined, { sensitivity: 'base' })
        return comparison * direction
      }
      case 'totalDiagnostics':
        return (a.totalDiagnostics - b.totalDiagnostics) * direction
      case 'countries': {
        const countDiff = a.countries.length - b.countries.length
        if (countDiff !== 0) return countDiff * direction
        return a.countries.join(', ').localeCompare(b.countries.join(', '), undefined, { sensitivity: 'base' }) * direction
      }
      case 'latestDiagnosticDate': {
        const aTime = a.latestDiagnosticDate ? new Date(a.latestDiagnosticDate).getTime() : 0
        const bTime = b.latestDiagnosticDate ? new Date(b.latestDiagnosticDate).getTime() : 0
        return (aTime - bTime) * direction
      }
      default:
        return 0
    }
  })

  return (
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

        {data && !loading && (
          <>
            {/* Overall Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Total Users</p>
                    <p className="text-3xl font-bold text-gray-900">{data.overallStats.totalUsers}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Total Diagnostics</p>
                    <p className="text-3xl font-bold text-gray-900">{data.overallStats.totalDiagnostics}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Avg per User</p>
                    <p className="text-3xl font-bold text-gray-900">{data.overallStats.averageDiagnosticsPerUser}</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by user name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 pl-11 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
                <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* User Stats Table */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={() => handleSort('userName')}
                          className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                          User
                          <SortIcon column="userName" />
                        </button>
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={() => handleSort('totalDiagnostics')}
                          className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                          Total Diagnostics
                          <SortIcon column="totalDiagnostics" />
                        </button>
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={() => handleSort('countries')}
                          className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                          Countries
                          <SortIcon column="countries" />
                        </button>
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={() => handleSort('latestDiagnosticDate')}
                          className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors"
                        >
                          Latest Activity
                          <SortIcon column="latestDiagnosticDate" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                          No users found matching "{searchTerm}"
                        </td>
                      </tr>
                    ) : (
                      sortedUsers.map((stat) => (
                        <tr key={stat.userId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{stat.userName}</div>
                              <div className="text-sm text-gray-500">{stat.userId}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {stat.totalDiagnostics} {stat.totalDiagnostics === 1 ? 'diagnostic' : 'diagnostics'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex gap-1">
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(stat.latestDiagnosticDate)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

