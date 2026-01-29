import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/survey/email/[token] - Get survey data for email invite token
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Find the survey invite
    const invite = await prisma.surveyInvite.findUnique({
      where: { token },
      include: {
        shop: {
          include: {
            company: {
              select: { name: true },
            },
          },
        },
      },
    })

    if (!invite) {
      return NextResponse.json(
        { error: 'このリンクは無効です', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Check if already completed
    if (invite.completedAt) {
      return NextResponse.json(
        { error: 'すでに回答済みです', code: 'ALREADY_COMPLETED' },
        { status: 400 }
      )
    }

    // Check if shop is active
    if (invite.shop.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'このアンケートは無効です', code: 'INACTIVE' },
        { status: 400 }
      )
    }

    // Update openedAt if first time opening
    if (!invite.openedAt) {
      await prisma.surveyInvite.update({
        where: { id: invite.id },
        data: { openedAt: new Date() },
      })
    }

    // Get survey questions
    const questions = await prisma.question.findMany({
      orderBy: { order: 'asc' },
      select: {
        id: true,
        order: true,
        textJa: true,
        textEn: true,
        category: true,
        isReversed: true,
        isOutcome: true,
        scale: true,
      },
    })

    return NextResponse.json({
      inviteId: invite.id,
      shop: {
        id: invite.shop.id,
        name: invite.shop.name,
        companyName: invite.shop.company.name,
      },
      questions,
    })
  } catch (error) {
    console.error('Error fetching email survey:', error)
    return NextResponse.json(
      { error: 'Failed to fetch survey' },
      { status: 500 }
    )
  }
}
