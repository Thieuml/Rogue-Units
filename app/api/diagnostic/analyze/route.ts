import { NextRequest, NextResponse } from 'next/server'
import { fetchVisitReports, fetchBreakdowns, fetchMaintenanceIssues, fetchRepairRequests } from '@/lib/looker'
import { generateDiagnosticAnalysis, DiagnosticData } from '@/lib/llm-analysis'
import { parseDaysFromContext } from '@/lib/date-parser'
import { storeDiagnostic } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    const requiredEnvVars = {
      LOOKER_API_BASE_URL: process.env.LOOKER_API_BASE_URL,
      LOOKER_CLIENT_ID: process.env.LOOKER_CLIENT_ID,
      LOOKER_CLIENT_SECRET: process.env.LOOKER_CLIENT_SECRET,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    }
    
    const missingEnvVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key)
    
    if (missingEnvVars.length > 0) {
      console.error('[API] Missing required environment variables:', missingEnvVars)
      return NextResponse.json(
        { 
          error: 'Server configuration error', 
          details: `Missing environment variables: ${missingEnvVars.join(', ')}`
        },
        { status: 500 }
      )
    }
    
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
    const maintenanceTimestamps = maintenanceVisits
      .map((v: any) => {
        const dateStr = v.date || v.completedDate
        if (!dateStr) return 0
        const date = new Date(dateStr)
        return isNaN(date.getTime()) ? 0 : date.getTime()
      })
      .filter((time: number) => time > 0)
    
    const lastMaintenance = maintenanceTimestamps.length > 0
      ? new Date(Math.max(...maintenanceTimestamps))
      : null
    const timeSinceLastMaintenance = lastMaintenance && !isNaN(lastMaintenance.getTime())
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
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    }
    console.error('[API] Error details:', JSON.stringify(errorDetails, null, 2))
    return NextResponse.json(
      { 
        error: 'Failed to analyze diagnostic', 
        details: errorDetails.message,
        // Only include stack in development
        ...(process.env.NODE_ENV === 'development' ? { stack: errorDetails.stack } : {})
      },
      { status: 500 }
    )
  }
}

