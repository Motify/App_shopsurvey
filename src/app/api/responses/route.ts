import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Updated answer schema for 11 questions:
// Q1-Q9: 1-5 scale
// Q10: 0-10 scale (eNPS)
const answerSchema = z.object({
  q1: z.number().int().min(1).max(5),
  q2: z.number().int().min(1).max(5),
  q3: z.number().int().min(1).max(5),
  q4: z.number().int().min(1).max(5),
  q5: z.number().int().min(1).max(5),
  q6: z.number().int().min(1).max(5),
  q7: z.number().int().min(1).max(5),
  q8: z.number().int().min(1).max(5),
  q9: z.number().int().min(1).max(5),
  q10: z.number().int().min(0).max(10), // eNPS: 0-10 scale
})

const submitResponseSchema = z.object({
  shopId: z.string().min(1, 'Shop ID is required'),
  answers: answerSchema,
  comment: z.string().max(500).nullable().optional(), // Free text comment (optional)
  timeSpentSeconds: z.number().int().optional(),
  inviteToken: z.string().optional(), // For email survey submissions
})

// POST /api/responses - Submit survey response (public)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validation = submitResponseSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid response data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { shopId, answers, comment, timeSpentSeconds, inviteToken } = validation.data

    // If inviteToken provided, validate the survey invite
    let surveyInvite = null
    if (inviteToken) {
      surveyInvite = await prisma.surveyInvite.findUnique({
        where: { token: inviteToken },
      })

      if (!surveyInvite) {
        return NextResponse.json(
          { error: 'Invalid survey invite' },
          { status: 400 }
        )
      }

      if (surveyInvite.completedAt) {
        return NextResponse.json(
          { error: 'Survey already completed' },
          { status: 400 }
        )
      }

      // Verify the shop matches the invite
      if (surveyInvite.shopId !== shopId) {
        return NextResponse.json(
          { error: 'Shop mismatch' },
          { status: 400 }
        )
      }
    }

    // Verify shop exists and is active
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, status: true },
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    if (shop.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Shop is not accepting responses' },
        { status: 400 }
      )
    }

    // Create response record
    const response = await prisma.response.create({
      data: {
        shopId,
        answers: {
          ...answers,
          ...(timeSpentSeconds !== undefined && { timeSpentSeconds }),
        },
        comment: comment || null, // Free text comment
      },
    })

    // If this was an email survey, update the invite with response link
    if (surveyInvite) {
      await prisma.surveyInvite.update({
        where: { id: surveyInvite.id },
        data: {
          responseId: response.id,
          completedAt: new Date(),
        },
      })
    }

    return NextResponse.json(
      { success: true, responseId: response.id },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error submitting response:', error)
    return NextResponse.json(
      { error: 'Failed to submit response' },
      { status: 500 }
    )
  }
}
