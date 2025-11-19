import { NextRequest, NextResponse } from 'next/server'
import { fetchVisitReports, fetchFaultLogs, fetchIoTAlerts, fetchPartsReplaced } from '@/lib/looker'
import { generateDiagnosticAnalysis, DiagnosticData } from '@/lib/llm-analysis'
import { generatePDFBuffer, generatePDFFilename } from '@/lib/pdf-generator'
import { storePDF } from '@/lib/storage'
import path from 'path'
import fs from 'fs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { unitId, unitName, buildingId, buildingName, context, daysBack = 90 } = body
    
    if (!unitId || !unitName || !buildingId || !buildingName) {
      return NextResponse.json(
        { error: 'unitId, unitName, buildingId, and buildingName are required' },
        { status: 400 }
      )
    }
    
    // Fetch all diagnostic data
    console.log(`[API] Fetching diagnostic data for unit ${unitId}`)
    const [visitReports, faultLogs, iotAlerts, partsReplaced] = await Promise.all([
      fetchVisitReports(unitId, daysBack),
      fetchFaultLogs(unitId, daysBack),
      fetchIoTAlerts(unitId, daysBack),
      fetchPartsReplaced(unitId, daysBack),
    ])
    
    // Calculate callback frequency (visits marked as callbacks)
    const callbackFrequency = visitReports.filter((v: any) => 
      v.type === 'callback' || v.reason?.toLowerCase().includes('callback')
    ).length
    
    // Calculate time since last maintenance
    const maintenanceVisits = visitReports.filter((v: any) => 
      v.type === 'maintenance' || v.reason?.toLowerCase().includes('maintenance')
    )
    const lastMaintenance = maintenanceVisits.length > 0
      ? new Date(Math.max(...maintenanceVisits.map((v: any) => new Date(v.date).getTime())))
      : null
    const timeSinceLastMaintenance = lastMaintenance
      ? Math.floor((Date.now() - lastMaintenance.getTime()) / (1000 * 60 * 60 * 24))
      : undefined
    
    // Prepare diagnostic data
    const diagnosticData: DiagnosticData = {
      unitId,
      unitName,
      buildingName,
      visitReports,
      faultLogs,
      iotAlerts,
      partsReplaced,
      callbackFrequency,
      timeSinceLastMaintenance,
      context,
    }
    
    // Generate LLM analysis
    console.log(`[API] Generating LLM analysis`)
    const analysis = await generateDiagnosticAnalysis(diagnosticData)
    
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
    return new NextResponse(pdfBuffer, {
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

