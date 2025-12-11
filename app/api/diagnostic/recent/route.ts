import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { listStoredDiagnostics } from '@/lib/storage'
import { normalizeToV1 } from '@/lib/llm-analysis-adapter'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const country = searchParams.get('country')
    const userId = searchParams.get('userId') // For "My Diagnostics" filter
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const unitId = searchParams.get('unitId')
    const unitName = searchParams.get('unitName')
    
    // Get current user session
    const session = await getServerSession(authOptions)
    const currentUserId = session?.user?.id || session?.user?.email || null
    
    console.log('[API] Fetching diagnostics with filters:', {
      country,
      userId: userId === 'me' ? currentUserId : userId,
      startDate,
      endDate,
      unitId,
      unitName,
    })
    
    // Build filters
    const filters: any = {}
    
    if (country) {
      filters.country = country
    }
    
    // If userId is 'me', use current user's ID
    if (userId === 'me' && currentUserId) {
      filters.userId = currentUserId
    } else if (userId && userId !== 'me') {
      filters.userId = userId
    }
    
    if (startDate) {
      filters.startDate = new Date(startDate)
    }
    
    if (endDate) {
      filters.endDate = new Date(endDate)
    }
    
    if (unitId) {
      filters.unitId = unitId
    }
    
    if (unitName) {
      filters.unitName = unitName
    }
    
    // If no date filter, default to last 30 days for performance
    if (!startDate && !endDate) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      filters.startDate = thirtyDaysAgo
    }
    
    const diagnostics = await listStoredDiagnostics(filters)
    console.log('[API] Found diagnostics:', diagnostics.length)
    
    // Return diagnostics with user info
    // Normalize analysis to V1 format for UI compatibility
    const results = diagnostics.map(diag => ({
      id: diag.id,
      unitId: diag.unitId,
      unitName: diag.unitName,
      buildingName: diag.buildingName,
      country: diag.country,
      userId: diag.userId,
      userName: diag.userName,
      visitReports: diag.visitReports || [],
      breakdowns: diag.breakdowns || [],
      maintenanceIssues: diag.maintenanceIssues || [],
      repairRequests: diag.repairRequests || [],
      analysis: diag.analysis ? normalizeToV1(diag.analysis) : null,
      generatedAt: diag.generatedAt,
    }))
    
    return NextResponse.json({
      results,
    })
  } catch (error) {
    console.error('[API] Error fetching recent results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recent results', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
