import { NextRequest, NextResponse } from 'next/server'
import { listStoredDiagnostics } from '@/lib/storage'

export async function GET(request: NextRequest) {
  try {
    console.log('[API] Fetching recent diagnostics...')
    
    // Get all diagnostics from last 7 days
    const allDiagnostics = listStoredDiagnostics()
    console.log('[API] Total stored diagnostics:', allDiagnostics.length)
    
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
    console.log('[API] Filtering diagnostics from last 7 days (since:', new Date(sevenDaysAgo).toISOString(), ')')
    
    const recentDiagnostics = allDiagnostics.filter(diag => {
      const generatedTime = new Date(diag.generatedAt).getTime()
      return generatedTime >= sevenDaysAgo
    })
    
    console.log('[API] Recent diagnostics (last 7 days):', recentDiagnostics.length)
    recentDiagnostics.forEach((diag, idx) => {
      console.log(`[API] Diagnostic ${idx + 1}:`, {
        unitId: diag.unitId,
        unitName: diag.unitName,
        buildingName: diag.buildingName,
        generatedAt: diag.generatedAt,
        visitCount: diag.visitReports?.length || 0,
        breakdownCount: diag.breakdowns?.length || 0,
        hasAnalysis: !!diag.analysis,
      })
    })
    
    // Return diagnostics directly (they already have all the data)
    const results = recentDiagnostics.slice(0, 20).map(diag => ({
      unitId: diag.unitId,
      unitName: diag.unitName,
      buildingName: diag.buildingName,
      visitReports: diag.visitReports || [],
      breakdowns: diag.breakdowns || [],
      maintenanceIssues: diag.maintenanceIssues || [],
      repairRequests: diag.repairRequests || [],
      analysis: diag.analysis || null,
      generatedAt: diag.generatedAt,
    }))
    
    console.log('[API] Returning recent diagnostics:', {
      totalDiagnostics: recentDiagnostics.length,
      returnedResults: results.length,
      results: results.map(r => ({
        unitName: r.unitName,
        unitId: r.unitId,
        visitCount: r.visitReports.length,
        breakdownCount: r.breakdowns.length,
        hasAnalysis: !!r.analysis,
      })),
    })
    
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
