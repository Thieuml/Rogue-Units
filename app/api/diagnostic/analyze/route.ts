import { NextRequest, NextResponse } from 'next/server'
import { fetchVisitReports, fetchBreakdowns, fetchMaintenanceIssues, fetchRepairRequests } from '@/lib/looker'
import { generateDiagnosticAnalysis, DiagnosticData } from '@/lib/llm-analysis'
import { parseDaysFromContext } from '@/lib/date-parser'
import { storeDiagnostic } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { unitId, unitName, buildingId, buildingName, context } = body
    
    if (!unitId || !unitName || !buildingId || !buildingName) {
      return NextResponse.json(
        { error: 'unitId, unitName, buildingId, and buildingName are required' },
        { status: 400 }
      )
    }
    
    // Parse date range from context (default: 90 days)
    const daysBack = parseDaysFromContext(context || '')
    console.log(`[API] Parsed daysBack=${daysBack} from context: "${context}"`)
    
    // Fetch visit reports, breakdowns, maintenance issues, and repair requests
    console.log(`[API] Fetching diagnostic data for device ${unitId} (last ${daysBack} days)`)
    const [visitReports, breakdowns, maintenanceIssues, repairRequests] = await Promise.all([
      fetchVisitReports(unitId, daysBack).catch(err => {
        console.error('[API] Error fetching visit reports:', err)
        return [] // Return empty array on error
      }),
      fetchBreakdowns(unitId, daysBack).catch(err => {
        console.error('[API] Error fetching breakdowns:', err)
        return [] // Return empty array on error
      }),
      fetchMaintenanceIssues(unitId, daysBack).catch(err => {
        console.error('[API] Error fetching maintenance issues:', err)
        return [] // Return empty array on error
      }),
      fetchRepairRequests(unitId, daysBack).catch(err => {
        console.error('[API] Error fetching repair requests:', err)
        return [] // Return empty array on error
      }),
    ])
    
    console.log(`[API] Fetched data: ${visitReports.length} visits, ${breakdowns.length} breakdowns, ${maintenanceIssues.length} maintenance issues, ${repairRequests.length} repair requests`)
    
    // Calculate callback frequency (visits marked as callbacks)
    const callbackFrequency = visitReports.filter((v: any) =>
      v.type?.toLowerCase().includes('callout') || v.type?.toLowerCase().includes('breakdown')
    ).length
    
    // Calculate time since last maintenance
    const maintenanceVisits = visitReports.filter((v: any) =>
      v.type?.toLowerCase().includes('regular') || v.type?.toLowerCase().includes('maintenance')
    )
    const lastMaintenance = maintenanceVisits.length > 0
      ? new Date(Math.max(...maintenanceVisits.map((v: any) => new Date(v.date).getTime())))
      : null
    const timeSinceLastMaintenance = lastMaintenance
      ? Math.floor((Date.now() - lastMaintenance.getTime()) / (1000 * 60 * 60 * 24))
      : undefined
    
    // Prepare diagnostic data (no IoT or parts)
    const diagnosticData: DiagnosticData = {
      unitId,
      unitName,
      buildingName,
      visitReports,
      breakdowns,
      maintenanceIssues,
      repairRequests,
      faultLogs: [], // Not used
      iotAlerts: [], // Not used
      partsReplaced: [], // Not used
      callbackFrequency,
      timeSinceLastMaintenance,
      context: context?.trim() || undefined,
    }
    
    // Generate LLM analysis
    console.log(`[API] Generating LLM analysis`)
    const analysis = await generateDiagnosticAnalysis(diagnosticData)
    
    // Store diagnostic result for recent diagnostics
    try {
      storeDiagnostic({
        unitId,
        unitName,
        buildingName,
        generatedAt: new Date(),
        visitReports,
        breakdowns,
        maintenanceIssues,
        repairRequests,
        analysis,
      })
      console.log(`[API] Stored diagnostic for ${unitName}`)
    } catch (error) {
      console.error('[API] Error storing diagnostic:', error)
      // Don't fail the request if storage fails
    }
    
    return NextResponse.json({
      visitReports,
      breakdowns,
      maintenanceIssues,
      repairRequests,
      analysis,
    })
  } catch (error) {
    console.error('[API] Error analyzing diagnostic:', error)
    return NextResponse.json(
      { error: 'Failed to analyze diagnostic', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

