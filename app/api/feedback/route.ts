import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * POST /api/feedback
 * Submit feedback for a diagnostic section
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { diagnosticId, section, sectionLabel, sentiment, category, comment } = body

    // Validate required fields
    if (!diagnosticId || !section || !sectionLabel || !sentiment) {
      return NextResponse.json(
        { error: 'Missing required fields: diagnosticId, section, sectionLabel, sentiment' },
        { status: 400 }
      )
    }

    // Validate sentiment
    if (sentiment !== 'positive' && sentiment !== 'negative') {
      return NextResponse.json(
        { error: 'Invalid sentiment. Must be "positive" or "negative"' },
        { status: 400 }
      )
    }

    // Check if diagnostic exists
    const diagnostic = await prisma.diagnostic.findUnique({
      where: { id: diagnosticId }
    })

    if (!diagnostic) {
      return NextResponse.json(
        { error: 'Diagnostic not found' },
        { status: 404 }
      )
    }

    // Check if user already provided feedback for this section
    const existingFeedback = await prisma.feedback.findFirst({
      where: {
        diagnosticId,
        section,
        userId: session.user.email
      }
    })

    let feedback
    if (existingFeedback) {
      // Update existing feedback
      feedback = await prisma.feedback.update({
        where: { id: existingFeedback.id },
        data: {
          sentiment,
          category,
          comment,
        }
      })
    } else {
      // Create new feedback
      feedback = await prisma.feedback.create({
        data: {
          diagnosticId,
          section,
          sectionLabel,
          sentiment,
          category,
          comment,
          userId: session.user.email,
          userName: session.user.name || session.user.email,
        }
      })
    }

    return NextResponse.json(feedback)
  } catch (error) {
    console.error('[Feedback API] Error creating feedback:', error)
    return NextResponse.json(
      { error: 'Failed to create feedback', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/feedback
 * Retrieve all feedback (admin only)
 * Query params: diagnosticId (optional - filter by specific diagnostic)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const diagnosticId = searchParams.get('diagnosticId')
    const userId = searchParams.get('userId')

    // Build where clause
    const where: any = {}
    if (diagnosticId) {
      where.diagnosticId = diagnosticId
    }
    if (userId) {
      where.userId = userId
    }

    // Fetch feedback with diagnostic metadata
    const feedback = await prisma.feedback.findMany({
      where,
      include: {
        diagnostic: {
          select: {
            id: true,
            unitName: true,
            buildingName: true,
            generatedAt: true,
            userId: true,
            userName: true,
            country: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(feedback)
  } catch (error) {
    console.error('[Feedback API] Error fetching feedback:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feedback', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/feedback
 * Delete a specific feedback entry (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { feedbackId } = body

    if (!feedbackId) {
      return NextResponse.json(
        { error: 'Missing required field: feedbackId' },
        { status: 400 }
      )
    }

    // Delete feedback
    await prisma.feedback.delete({
      where: { id: feedbackId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Feedback API] Error deleting feedback:', error)
    return NextResponse.json(
      { error: 'Failed to delete feedback', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}



