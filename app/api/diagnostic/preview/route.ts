import { NextRequest, NextResponse } from 'next/server'
import { fetchVisitReports, fetchFaultLogs, fetchIoTAlerts, fetchPartsReplaced } from '@/lib/looker'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { unitId, daysBack = 90 } = body
    
    if (!unitId) {
      return NextResponse.json(
        { error: 'unitId is required' },
        { status: 400 }
      )
    }
    
    // Fetch data counts for preview
    const [visitReports, faultLogs, iotAlerts, partsReplaced] = await Promise.all([
      fetchVisitReports(unitId, daysBack),
      fetchFaultLogs(unitId, daysBack),
      fetchIoTAlerts(unitId, daysBack),
      fetchPartsReplaced(unitId, daysBack),
    ])
    
    return NextResponse.json({
      preview: `I'll compile the last ${daysBack} days of visits (${visitReports.length}), faults (${faultLogs.length}), alerts (${iotAlerts.length}), and parts (${partsReplaced.length}) for this unit.`,
      counts: {
        visits: visitReports.length,
        faults: faultLogs.length,
        alerts: iotAlerts.length,
        parts: partsReplaced.length,
      },
    })
  } catch (error) {
    console.error('[API] Error generating preview:', error)
    return NextResponse.json(
      { error: 'Failed to generate preview', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

