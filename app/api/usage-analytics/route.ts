import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * GET /api/usage-analytics
 * Returns user statistics including diagnostic count and latest diagnostic date
 */
export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all diagnostics grouped by userId
    const diagnostics = await prisma.diagnostic.findMany({
      where: {
        userId: {
          not: null
        }
      },
      select: {
        userId: true,
        userName: true,
        generatedAt: true,
        country: true
      },
      orderBy: {
        generatedAt: 'desc'
      }
    })

    // Group by userId and calculate statistics
    const userStatsMap = new Map<string, {
      userId: string
      userName: string
      totalDiagnostics: number
      latestDiagnosticDate: Date
      countries: Set<string>
    }>()

    diagnostics.forEach((diag) => {
      if (!diag.userId) return

      const existing = userStatsMap.get(diag.userId)
      
      if (existing) {
        existing.totalDiagnostics++
        if (diag.generatedAt > existing.latestDiagnosticDate) {
          existing.latestDiagnosticDate = diag.generatedAt
        }
        existing.countries.add(diag.country)
      } else {
        userStatsMap.set(diag.userId, {
          userId: diag.userId,
          userName: diag.userName || diag.userId,
          totalDiagnostics: 1,
          latestDiagnosticDate: diag.generatedAt,
          countries: new Set([diag.country])
        })
      }
    })

    // Convert to array and sort by total diagnostics (descending)
    const userStats = Array.from(userStatsMap.values())
      .map(stat => ({
        userId: stat.userId,
        userName: stat.userName,
        totalDiagnostics: stat.totalDiagnostics,
        latestDiagnosticDate: stat.latestDiagnosticDate.toISOString(),
        countries: Array.from(stat.countries).sort()
      }))
      .sort((a, b) => b.totalDiagnostics - a.totalDiagnostics)

    // Calculate overall statistics
    const overallStats = {
      totalUsers: userStats.length,
      totalDiagnostics: userStats.reduce((sum, stat) => sum + stat.totalDiagnostics, 0),
      averageDiagnosticsPerUser: userStats.length > 0 
        ? (userStats.reduce((sum, stat) => sum + stat.totalDiagnostics, 0) / userStats.length).toFixed(1)
        : '0'
    }

    return NextResponse.json({
      userStats,
      overallStats
    })
  } catch (error) {
    console.error('[Usage Analytics API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch usage analytics' },
      { status: 500 }
    )
  }
}

