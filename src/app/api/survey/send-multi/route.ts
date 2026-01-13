import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendSurveyInviteJa } from '@/lib/mailgun'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { getAccessibleShopIds } from '@/lib/access'

const emailEntrySchema = z.object({
  email: z.string().email(),
  shopNumber: z.string().optional(),
  shopName: z.string().optional(),
})

const sendMultiShopSchema = z.object({
  entries: z.array(emailEntrySchema).min(1, 'At least one email is required'),
})

interface ShopMatch {
  id: string
  name: string
  shopNumber: string | null
}

const CHUNK_SIZE = 50
const CHUNK_DELAY_MS = 1000

// POST /api/survey/send-multi - Send survey invitations to multiple shops
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = sendMultiShopSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { entries } = validation.data

    // Get accessible shop IDs for this admin
    const { shopIds } = await getAccessibleShopIds(session.user.id)

    // Fetch all accessible shops for matching
    const shops = await prisma.shop.findMany({
      where: { id: { in: shopIds } },
      select: { id: true, name: true, shopNumber: true },
    })

    // Build lookup maps for shop matching
    const shopByNumber = new Map<string, ShopMatch>()
    const shopByName = new Map<string, ShopMatch>()

    for (const shop of shops) {
      if (shop.shopNumber) {
        shopByNumber.set(shop.shopNumber.toLowerCase(), shop)
      }
      shopByName.set(shop.name.toLowerCase(), shop)
    }

    // Group entries by shop
    const entriesByShop = new Map<string, { email: string; shopId: string }[]>()
    const unmatchedEntries: { email: string; reason: string }[] = []

    for (const entry of entries) {
      let matchedShop: ShopMatch | undefined

      // Try to match by shop number first (more specific)
      if (entry.shopNumber) {
        matchedShop = shopByNumber.get(entry.shopNumber.toLowerCase())
      }

      // Fall back to shop name if no number match
      if (!matchedShop && entry.shopName) {
        matchedShop = shopByName.get(entry.shopName.toLowerCase())
      }

      if (!matchedShop) {
        const shopInfo = entry.shopNumber || entry.shopName || '指定なし'
        unmatchedEntries.push({
          email: entry.email,
          reason: `店舗が見つかりません: ${shopInfo}`,
        })
        continue
      }

      const shopEntries = entriesByShop.get(matchedShop.id) || []
      shopEntries.push({ email: entry.email.toLowerCase(), shopId: matchedShop.id })
      entriesByShop.set(matchedShop.id, shopEntries)
    }

    // Process each shop's emails
    const results = {
      sent: 0,
      failed: [...unmatchedEntries] as { email: string; reason: string }[],
      shopBreakdown: [] as { shopId: string; shopName: string; sent: number; failed: number }[],
    }

    for (const [shopId, shopEntries] of Array.from(entriesByShop.entries())) {
      const shop = shops.find(s => s.id === shopId)!

      // Remove duplicates within this shop
      const uniqueEmails = Array.from(new Set(shopEntries.map(e => e.email)))

      // Create survey batch for this shop
      const batch = await prisma.surveyBatch.create({
        data: {
          shopId,
          adminId: session.user.id,
          totalSent: uniqueEmails.length,
          method: 'csv',
        },
      })

      let shopSent = 0
      let shopFailed = 0

      // Process in chunks
      for (let i = 0; i < uniqueEmails.length; i += CHUNK_SIZE) {
        const chunk = uniqueEmails.slice(i, i + CHUNK_SIZE)

        const chunkResults = await Promise.allSettled(
          chunk.map(async (email) => {
            const token = nanoid(21)

            await prisma.surveyInvite.create({
              data: {
                batchId: batch.id,
                shopId,
                email,
                token,
              },
            })

            await sendSurveyInviteJa(email, token)
            return email
          })
        )

        chunkResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            shopSent++
            results.sent++
          } else {
            shopFailed++
            results.failed.push({
              email: chunk[index],
              reason: result.reason instanceof Error ? result.reason.message : 'Unknown error',
            })
          }
        })

        // Delay between chunks
        if (i + CHUNK_SIZE < uniqueEmails.length) {
          await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS))
        }
      }

      // Update batch with actual sent count
      if (shopFailed > 0) {
        await prisma.surveyBatch.update({
          where: { id: batch.id },
          data: { totalSent: shopSent },
        })
      }

      results.shopBreakdown.push({
        shopId,
        shopName: shop.name,
        sent: shopSent,
        failed: shopFailed,
      })
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error sending multi-shop survey:', error)
    return NextResponse.json(
      { error: 'Failed to send survey' },
      { status: 500 }
    )
  }
}
