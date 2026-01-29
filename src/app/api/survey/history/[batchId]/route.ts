import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccessibleShopIds } from '@/lib/access'

// GET /api/survey/history/[batchId] - Get survey batch detail
export async function GET(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { batchId } = await params

    // Get the batch
    const batch = await prisma.surveyBatch.findUnique({
      where: { id: batchId },
      include: {
        shop: {
          select: { id: true, name: true, shopNumber: true },
        },
        invites: {
          select: {
            id: true,
            email: true,
            token: true,
            sentAt: true,
            openedAt: true,
            completedAt: true,
          },
          orderBy: { sentAt: 'asc' },
        },
      },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Check if admin has access to this shop
    const { shopIds } = await getAccessibleShopIds(session.user.id)

    if (!shopIds.includes(batch.shopId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Transform data
    const result = {
      id: batch.id,
      shopId: batch.shopId,
      shopName: batch.shop.name,
      shopNumber: batch.shop.shopNumber,
      sentAt: batch.sentAt,
      totalSent: batch.totalSent,
      invites: batch.invites.map(invite => ({
        id: invite.id,
        email: invite.email,
        sentAt: invite.sentAt,
        openedAt: invite.openedAt,
        completedAt: invite.completedAt,
        status: invite.completedAt
          ? 'completed'
          : invite.openedAt
          ? 'opened'
          : 'sent',
      })),
      stats: {
        sent: batch.invites.length,
        opened: batch.invites.filter(i => i.openedAt !== null).length,
        completed: batch.invites.filter(i => i.completedAt !== null).length,
      },
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching batch detail:', error)
    return NextResponse.json(
      { error: 'Failed to fetch batch detail' },
      { status: 500 }
    )
  }
}
