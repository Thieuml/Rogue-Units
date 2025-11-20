import { NextRequest, NextResponse } from 'next/server'
import { fetchBuildingsAndDevices } from '@/lib/looker'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const countryCode = searchParams.get('country') || 'FR'
    
    console.log(`[API] Fetching buildings and devices for country: ${countryCode}`)
    const { buildings, devices } = await fetchBuildingsAndDevices(countryCode)
    console.log(`[API] Successfully fetched ${buildings.length} buildings and ${devices.length} devices`)
    
    return NextResponse.json({ buildings, devices })
  } catch (error) {
    console.error('[API] Error fetching buildings:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('[API] Error details:', { errorMessage, errorStack })
    
    return NextResponse.json(
      { error: 'Failed to fetch buildings', details: errorMessage },
      { status: 500 }
    )
  }
}

