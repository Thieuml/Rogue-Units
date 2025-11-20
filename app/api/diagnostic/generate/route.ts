import { NextRequest, NextResponse } from 'next/server'
import { fetchVisitReports, fetchBreakdowns, fetchMaintenanceIssues, fetchRepairRequests } from '@/lib/looker'
import { generateDiagnosticAnalysis, DiagnosticData } from '@/lib/llm-analysis'
import { generatePDFBuffer, generatePDFFilename } from '@/lib/pdf-generator'
import { storePDF } from '@/lib/storage'
import { parseDaysFromContext } from '@/lib/date-parser'
import path from 'path'
import fs from 'fs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      unitId, 
      unitName, 
      buildingId, 
      buildingName, 
      context,
      visitReports: providedVisitReports,
      breakdowns: providedBreakdowns,
      maintenanceIssues: providedMaintenanceIssues,
      repairRequests: providedRepairRequests,
      analysis: providedAnalysis,
    } = body
    
    if (!unitId || !unitName || !buildingId || !buildingName) {
      return NextResponse.json(
        { error: 'unitId, unitName, buildingId, and buildingName are required' },
        { status: 400 }
      )
    }
    
    // Use provided data if available, otherwise fetch
    let visitReports = providedVisitReports
    let breakdowns = providedBreakdowns
    let maintenanceIssues = providedMaintenanceIssues
    let repairRequests = providedRepairRequests || []
    let analysis = providedAnalysis
    
    if (!visitReports || !breakdowns || !maintenanceIssues || !analysis) {
      // Parse date range from context (default: 90 days)
      const daysBack = parseDaysFromContext(context || '')
      console.log(`[API] Parsed daysBack=${daysBack} from context: "${context}"`)
      
      // Fetch visit reports, breakdowns, maintenance issues, and repair requests
      console.log(`[API] Fetching diagnostic data for device ${unitId} (last ${daysBack} days)`)
      const fetchedData = await Promise.all([
        visitReports || fetchVisitReports(unitId, daysBack).catch(err => {
          console.error('[API] Error fetching visit reports:', err)
          return []
        }),
        breakdowns || fetchBreakdowns(unitId, daysBack).catch(err => {
          console.error('[API] Error fetching breakdowns:', err)
          return []
        }),
        maintenanceIssues || fetchMaintenanceIssues(unitId, daysBack).catch(err => {
          console.error('[API] Error fetching maintenance issues:', err)
          return []
        }),
        repairRequests.length > 0 ? repairRequests : fetchRepairRequests(unitId, daysBack).catch(err => {
          console.error('[API] Error fetching repair requests:', err)
          return []
        }),
      ])
      
      visitReports = fetchedData[0] || []
      breakdowns = fetchedData[1] || []
      maintenanceIssues = fetchedData[2] || []
      repairRequests = fetchedData[3] || []
      
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
        ? new Date(Math.max(...maintenanceVisits.map((v: any) => new Date(v.date || v.completedDate).getTime())))
        : null
      const timeSinceLastMaintenance = lastMaintenance
        ? Math.floor((Date.now() - lastMaintenance.getTime()) / (1000 * 60 * 60 * 24))
        : undefined
      
      // Prepare diagnostic data (no IoT or parts)
      const diagnosticDataForAnalysis: DiagnosticData = {
        unitId,
        unitName,
        buildingName,
        visitReports,
        breakdowns,
        maintenanceIssues,
        repairRequests,
        faultLogs: [],
        iotAlerts: [],
        partsReplaced: [],
        callbackFrequency,
        timeSinceLastMaintenance,
        context: context?.trim() || undefined,
      }
      
      // Generate LLM analysis if not provided
      if (!analysis) {
        console.log(`[API] Generating LLM analysis`)
        analysis = await generateDiagnosticAnalysis(diagnosticDataForAnalysis)
      }
    } else {
      console.log(`[API] Using provided diagnostic data: ${visitReports.length} visits, ${breakdowns.length} breakdowns, ${maintenanceIssues.length} maintenance issues, ${repairRequests.length} repair requests`)
    }
    
    // Ensure analysis exists
    if (!analysis) {
      throw new Error('Analysis data is required for PDF generation')
    }
    
    // Prepare diagnostic data for PDF (ensure all fields are present)
    const diagnosticData: DiagnosticData = {
      unitId,
      unitName,
      buildingName,
      visitReports: visitReports || [],
      breakdowns: breakdowns || [],
      maintenanceIssues: maintenanceIssues || [],
      repairRequests: repairRequests || [],
      faultLogs: [],
      iotAlerts: [],
      partsReplaced: [],
      callbackFrequency: 0,
      timeSinceLastMaintenance: undefined,
      context: context?.trim() || undefined,
    }
    
    // Generate PDF
    console.log(`[API] Generating PDF`)
    const filename = generatePDFFilename(unitId, unitName)
    
    // Generate PDF as buffer
    const pdfBuffer = await generatePDFBuffer(diagnosticData, analysis)
    
    // Store PDF (if storage enabled)
    if (process.env.ENABLE_STORAGE === 'true') {
      // Write to temp file for storage
      const tempDir = path.join(process.cwd(), 'temp')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }
      const tempPath = path.join(tempDir, filename)
      fs.writeFileSync(tempPath, pdfBuffer)
      
      storePDF(tempPath, {
        unitId,
        unitName,
        buildingName,
        generatedAt: new Date(),
      })
      
      // Clean up temp file
      fs.unlinkSync(tempPath)
    }
    
    // Return PDF as response
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[API] Error generating diagnostic:', error)
    return NextResponse.json(
      { error: 'Failed to generate diagnostic', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

