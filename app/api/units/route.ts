import { NextRequest, NextResponse } from 'next/server'
import { fetchBuildingsAndDevices } from '@/lib/looker'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const countryCode = searchParams.get('country') || 'FR'
    const buildingId = searchParams.get('buildingId')
    
    if (!buildingId) {
      return NextResponse.json(
        { error: 'buildingId parameter is required' },
        { status: 400 }
      )
    }
    
    const { devices } = await fetchBuildingsAndDevices(countryCode)
    const units = devices.filter(d => d.buildingId === buildingId)
    
    return NextResponse.json({ units })
  } catch (error) {
    console.error('[API] Error fetching units:', error)
    return NextResponse.json(
      { error: 'Failed to fetch units', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

