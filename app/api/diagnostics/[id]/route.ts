import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getDiagnosticById } from '@/lib/storage'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const diagnosticId = params.id
    const diagnostic = await getDiagnosticById(diagnosticId)

    if (!diagnostic) {
      return NextResponse.json({ error: 'Diagnostic not found' }, { status: 404 })
    }

    return NextResponse.json(diagnostic)
  } catch (error) {
    console.error('Error fetching diagnostic:', error)
    return NextResponse.json(
      { error: 'Failed to fetch diagnostic' },
      { status: 500 }
    )
  }
}

