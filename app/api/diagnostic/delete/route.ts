import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * DELETE /api/diagnostic/delete
 * Hard-delete a diagnostic result from the database
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get diagnostic ID from query params
    const { searchParams } = new URL(request.url)
    const diagnosticId = searchParams.get('id')

    if (!diagnosticId) {
      return NextResponse.json(
        { error: 'Missing diagnostic ID' },
        { status: 400 }
      )
    }

    console.log(`[API] Delete request for diagnostic ${diagnosticId} by ${session.user.email}`)

    // Verify the diagnostic exists
    const diagnostic = await prisma.diagnostic.findUnique({
      where: { id: diagnosticId },
      select: {
        id: true,
        unitName: true,
        userId: true,
      },
    })

    if (!diagnostic) {
      return NextResponse.json(
        { error: 'Diagnostic not found' },
        { status: 404 }
      )
    }

    // Delete the diagnostic (hard delete)
    await prisma.diagnostic.delete({
      where: { id: diagnosticId },
    })

    console.log(`[API] Successfully deleted diagnostic ${diagnosticId} (${diagnostic.unitName})`)

    return NextResponse.json({
      success: true,
      message: 'Diagnostic deleted successfully',
      deletedId: diagnosticId,
    })
  } catch (error) {
    console.error('[API] Error deleting diagnostic:', error)
    return NextResponse.json(
      { error: 'Failed to delete diagnostic', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

