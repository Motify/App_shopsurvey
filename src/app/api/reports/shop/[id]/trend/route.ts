import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccessibleShopIds } from '@/lib/access'
import {
  calculateAllCategoryScores,
  calculateOverallScore,
  calculateENPS,
  ResponseAnswers,
  CategoryKey,
} from '@/lib/scoring'

// Helper to get all descendant shop IDs recursively
async function getDescendantShopIds(shopId: string): Promise<string[]> {
  const descendants: string[] = []

  const getChildren = async (parentId: string) => {
    const children = await prisma.shop.findMany({
      where: { parentId },
      select: { id: true },
    })

    for (const child of children) {
      descendants.push(child.id)
      await getChildren(child.id)
    }
  }

  await getChildren(shopId)
  return descendants
}

// Group responses by month
function groupResponsesByMonth(responses: { answers: unknown; enpsScore?: number | null; submittedAt: Date }[]): Map<string, { answers: unknown; enpsScore?: number | null; submittedAt: Date }[]> {
  const grouped = new Map<string, { answers: unknown; enpsScore?: number | null; submittedAt: Date }[]>()

  for (const response of responses) {
    const date = new Date(response.submittedAt)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, [])
    }
    grouped.get(monthKey)!.push(response)
  }

  return grouped
}

// GET /api/reports/shop/[id]/trend - Get trend data for a shop
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: shopId } = await params
    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '12', 10)
    const includeChildren = searchParams.get('includeChildren') === 'true'

    // Verify access
    const { shopIds: accessibleShopIds } = await getAccessibleShopIds(session.user.id)
    if (!accessibleShopIds.includes(shopId)) {
      // Check if accessible via parent
      const shop = await prisma.shop.findUnique({ where: { id: shopId } })
      if (!shop) {
        return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
      }

      let hasAccess = false
      let currentShop = shop
      while (currentShop.parentId && !hasAccess) {
        if (accessibleShopIds.includes(currentShop.parentId)) {
          hasAccess = true
        } else {
          const parentShop = await prisma.shop.findUnique({
            where: { id: currentShop.parentId },
          })
          if (!parentShop) break
          currentShop = parentShop
        }
      }

      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Get shop IDs to include
    let shopIds = [shopId]
    if (includeChildren) {
      const descendantIds = await getDescendantShopIds(shopId)
      shopIds = [...shopIds, ...descendantIds]
    }

    // Calculate start date
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)

    // Fetch responses
    const responses = await prisma.response.findMany({
      where: {
        shopId: { in: shopIds },
        submittedAt: { gte: startDate },
      },
      select: { answers: true, enpsScore: true, submittedAt: true },
      orderBy: { submittedAt: 'asc' },
    })

    // Group by month
    const byMonth = groupResponsesByMonth(responses)

    // Calculate scores per month
    const trendData = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, monthResponses]) => {
        const answers = monthResponses.map(r => r.answers as ResponseAnswers)
        const categoryScores = calculateAllCategoryScores(answers)
        const overallScore = calculateOverallScore(answers)
        const enpsResult = calculateENPS(monthResponses.map(r => ({
          answers: r.answers as ResponseAnswers,
          enpsScore: r.enpsScore,
        })))

        return {
          month,
          responseCount: monthResponses.length,
          overallScore,
          categoryScores,
          enps: enpsResult.score,
        }
      })

    // Fill in missing months with null
    const allMonths: string[] = []
    const currentDate = new Date(startDate)
    const now = new Date()
    while (currentDate <= now) {
      const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
      allMonths.push(monthKey)
      currentDate.setMonth(currentDate.getMonth() + 1)
    }

    const filledTrendData = allMonths.map(month => {
      const existing = trendData.find(t => t.month === month)
      if (existing) return existing

      return {
        month,
        responseCount: 0,
        overallScore: null,
        categoryScores: null as Record<CategoryKey, number | null> | null,
        enps: null,
      }
    })

    return NextResponse.json({
      shopId,
      months,
      includesChildren: includeChildren,
      trend: filledTrendData,
    })
  } catch (error) {
    console.error('Error fetching trend data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trend data' },
      { status: 500 }
    )
  }
}
