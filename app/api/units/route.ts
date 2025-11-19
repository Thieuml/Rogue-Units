import { NextRequest, NextResponse } from 'next/server'
import { fetchUnits } from '@/lib/looker'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const buildingId = searchParams.get('buildingId')
    
    if (!buildingId) {
      return NextResponse.json(
        { error: 'buildingId parameter is required' },
        { status: 400 }
      )
    }
    
    const units = await fetchUnits(buildingId)
    return NextResponse.json({ units })
  } catch (error) {
    console.error('[API] Error fetching units:', error)
    return NextResponse.json(
      { error: 'Failed to fetch units', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

