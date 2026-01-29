import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit, getClientIP, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit'
import { encryptIdentity } from '@/lib/encryption'
import { checkMultipleTexts } from '@/lib/content-flagging'

// Updated answer schema for new structure:
// Q1-Q9: 8 driver dimensions (1-5 scale)
// Q10: Retention intention outcome (1-5 scale)
// Q11 (eNPS): stored separately as enpsScore (0-10 scale)
// Q12: Free text stored as improvementText
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
  q10: z.number().int().min(1).max(5), // Retention intention (1-5 scale)
})

const submitResponseSchema = z.object({
  shopId: z.string().min(1, 'Shop ID is required'),
  answers: answerSchema,
  enpsScore: z.number().int().min(0).max(10), // Q11 eNPS (0-10 scale)
  improvementText: z.string().max(2000).nullable().optional(), // Q12 Free text (optional)
  comment: z.string().max(500).nullable().optional(), // Legacy: kept for backward compatibility
  timeSpentSeconds: z.number().int().optional(),
  inviteToken: z.string().optional(), // For email survey submissions
  // Identity escrow fields
  identity: z.string().max(200).nullable().optional(),
  identityConsent: z.boolean().optional(),
})

// POST /api/responses - Submit survey response (public)
export async function POST(request: Request) {
  // Rate limiting to prevent spam submissions
  const clientIP = getClientIP(request)
  const rateLimit = checkRateLimit(`survey-response:${clientIP}`, RATE_LIMITS.surveyResponse)
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit.resetTime)
  }

  try {
    const body = await request.json()
    const validation = submitResponseSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid response data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { shopId, answers, enpsScore, improvementText, comment, timeSpentSeconds, inviteToken, identity, identityConsent } = validation.data

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

    // Check for concerning content in free text (both improvementText and legacy comment)
    const flagResult = checkMultipleTexts([improvementText, comment])

    // Encrypt identity if provided and consent given
    let encryptedIdentityValue: string | null = null
    if (identity && identityConsent) {
      try {
        encryptedIdentityValue = encryptIdentity(identity)
      } catch (err) {
        console.error('Failed to encrypt identity:', err)
        // Continue without identity - don't fail the submission
      }
    }

    // Create response record
    const response = await prisma.response.create({
      data: {
        shopId,
        answers: {
          ...answers,
          ...(timeSpentSeconds !== undefined && { timeSpentSeconds }),
        },
        enpsScore, // Q11 eNPS (0-10 scale)
        improvementText: improvementText || null, // Q12 Free text
        comment: comment || null, // Legacy: Free text comment (kept for backward compatibility)
        // Identity escrow fields
        encryptedIdentity: encryptedIdentityValue,
        identityConsent: identityConsent ?? false,
        flagged: flagResult.flagged,
        flagReason: flagResult.flagged ? flagResult.reasons.join(', ') : null,
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
