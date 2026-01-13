import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendSurveyInviteJa } from '@/lib/mailgun'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { getAccessibleShopIds } from '@/lib/access'

const sendSurveySchema = z.object({
  shopId: z.string().min(1, 'Shop ID is required'),
  emails: z.array(z.string().email()).min(1, 'At least one email is required'),
  method: z.enum(['csv', 'manual']).optional().default('manual'),
})

const CHUNK_SIZE = 50
const CHUNK_DELAY_MS = 1000

// Helper to process emails in chunks
async function processEmailsInChunks(
  emails: string[],
  shopId: string,
  batchId: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ sent: number; failed: { email: string; reason: string }[] }> {
  const results = {
    sent: 0,
    failed: [] as { email: string; reason: string }[],
  }

  for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
    const chunk = emails.slice(i, i + CHUNK_SIZE)

    // Process chunk in parallel
    const chunkResults = await Promise.allSettled(
      chunk.map(async (email) => {
        const token = nanoid(21)

        // Create survey invite record
        await prisma.surveyInvite.create({
          data: {
            batchId,
            shopId,
            email,
            token,
          },
        })

        // Send email
        await sendSurveyInviteJa(email, token)
        return email
      })
    )

    // Process results
    chunkResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.sent++
      } else {
        results.failed.push({
          email: chunk[index],
          reason: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        })
      }
    })

    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + CHUNK_SIZE, emails.length), emails.length)
    }

    // Delay between chunks to avoid rate limits (except for last chunk)
    if (i + CHUNK_SIZE < emails.length) {
      await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS))
    }
  }

  return results
}

// POST /api/survey/send - Send survey invitations via email
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = sendSurveySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { shopId, emails, method } = validation.data

    // Check if admin has access to this shop
    const { shopIds } = await getAccessibleShopIds(session.user.id)

    if (!shopIds.includes(shopId)) {
      return NextResponse.json(
        { error: 'You do not have access to this shop' },
        { status: 403 }
      )
    }

    // Get shop details
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    // Remove duplicates and normalize emails
    const uniqueEmails = Array.from(new Set(emails.map((e) => e.toLowerCase().trim())))

    // Create survey batch
    const batch = await prisma.surveyBatch.create({
      data: {
        shopId,
        adminId: session.user.id,
        totalSent: uniqueEmails.length,
        method,
      },
    })

    // Process emails in chunks
    const results = await processEmailsInChunks(uniqueEmails, shopId, batch.id)

    // Update batch with actual sent count if there were failures
    if (results.failed.length > 0) {
      await prisma.surveyBatch.update({
        where: { id: batch.id },
        data: { totalSent: results.sent },
      })
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error sending survey:', error)
    return NextResponse.json(
      { error: 'Failed to send survey' },
      { status: 500 }
    )
  }
}
