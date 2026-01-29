import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccessibleShopIds } from '@/lib/access'

// GET /api/survey/history - Get survey batch history
export async function GET() {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get accessible shop IDs for this admin
    const { shopIds } = await getAccessibleShopIds(session.user.id)

    // Get all batches for accessible shops with aggregated stats
    const batches = await prisma.surveyBatch.findMany({
      where: {
        shopId: { in: shopIds },
      },
      include: {
        shop: {
          select: { id: true, name: true, shopNumber: true },
        },
        invites: {
          select: {
            id: true,
            openedAt: true,
            completedAt: true,
          },
        },
      },
      orderBy: { sentAt: 'desc' },
    })

    // Transform data with statistics
    const result = batches.map(batch => ({
      id: batch.id,
      shopId: batch.shopId,
      shopName: batch.shop.name,
      shopNumber: batch.shop.shopNumber,
      sentAt: batch.sentAt,
      totalSent: batch.totalSent,
      method: batch.method,
      opened: batch.invites.filter(i => i.openedAt !== null).length,
      completed: batch.invites.filter(i => i.completedAt !== null).length,
      openRate: batch.totalSent > 0
        ? Math.round((batch.invites.filter(i => i.openedAt !== null).length / batch.totalSent) * 100)
        : 0,
      completionRate: batch.totalSent > 0
        ? Math.round((batch.invites.filter(i => i.completedAt !== null).length / batch.totalSent) * 100)
        : 0,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching survey history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch survey history' },
      { status: 500 }
    )
  }
}
