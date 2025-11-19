import { NextResponse } from 'next/server'
import { fetchBuildings } from '@/lib/looker'

export async function GET() {
  try {
    const buildings = await fetchBuildings()
    return NextResponse.json({ buildings })
  } catch (error) {
    console.error('[API] Error fetching buildings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch buildings', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

