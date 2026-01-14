import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccessibleShopIds } from '@/lib/access'
import {
  calculateAllCategoryScores,
  calculateOverallScore,
  calculateENPS,
  CATEGORY_LABELS,
  CategoryKey,
  ResponseAnswers,
} from '@/lib/scoring'

interface ShopReport {
  shop: {
    id: string
    name: string
    parentId: string | null
  }
  scores: {
    overall: number | null
    categories: Record<string, number | null>
    enps: number | null
  }
  responseCount: number
}

interface GapAnalysis {
  category: string
  categoryKey: string
  best: { shop: string; score: number }
  worst: { shop: string; score: number }
  gap: number
}

// Calculate rankings for shops
function calculateRankings(shopReports: ShopReport[]) {
  // Separate shops with and without data
  const withData = shopReports.filter(r => r.scores.overall !== null)
  const withoutData = shopReports.filter(r => r.scores.overall === null)

  // Sort shops with data by score, then append shops without data at the end
  const rankings = {
    overall: [
      ...withData.sort((a, b) => (b.scores.overall ?? 0) - (a.scores.overall ?? 0)),
      ...withoutData,
    ],
    byCategory: {} as Record<string, ShopReport[]>,
  }

  const categories = Object.keys(CATEGORY_LABELS).filter(k => k !== 'ENPS' && k !== 'FREE_TEXT') as CategoryKey[]

  for (const category of categories) {
    const categoryWithData = shopReports.filter(r => r.scores.categories[category] !== null)
    const categoryWithoutData = shopReports.filter(r => r.scores.categories[category] === null)

    rankings.byCategory[category] = [
      ...categoryWithData.sort((a, b) => (b.scores.categories[category] ?? 0) - (a.scores.categories[category] ?? 0)),
      ...categoryWithoutData,
    ]
  }

  return rankings
}

// Find biggest gaps between shops
function findBiggestGaps(shopReports: ShopReport[]): GapAnalysis[] {
  const gaps: GapAnalysis[] = []
  const validReports = shopReports.filter(r => r.scores.overall !== null)

  if (validReports.length < 2) return gaps

  const categories = Object.entries(CATEGORY_LABELS)
    .filter(([key]) => key !== 'ENPS' && key !== 'FREE_TEXT')
    .map(([key, labels]) => ({ key, name: labels.ja }))

  for (const category of categories) {
    const scores = validReports
      .filter(r => r.scores.categories[category.key] !== null)
      .map(r => ({
        shop: r.shop,
        score: r.scores.categories[category.key] as number,
      }))

    if (scores.length < 2) continue

    const sorted = scores.sort((a, b) => b.score - a.score)
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]
    const gap = best.score - worst.score

    gaps.push({
      category: category.name,
      categoryKey: category.key,
      best: { shop: best.shop.name, score: best.score },
      worst: { shop: worst.shop.name, score: worst.score },
      gap,
    })
  }

  // Sort by biggest gap
  return gaps.sort((a, b) => b.gap - a.gap)
}

// GET /api/reports/compare - Compare multiple shops
export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const shopIdsParam = searchParams.get('shopIds')
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    if (!shopIdsParam) {
      return NextResponse.json({ error: 'shopIds is required' }, { status: 400 })
    }

    const shopIds = shopIdsParam.split(',').filter(id => id.trim())

    if (shopIds.length < 2) {
      return NextResponse.json({ error: '最低2店舗を選択してください' }, { status: 400 })
    }

    if (shopIds.length > 5) {
      return NextResponse.json({ error: '最大5店舗まで選択できます' }, { status: 400 })
    }

    // Verify access to all shops
    const { shopIds: accessibleShopIds } = await getAccessibleShopIds(session.user.id)
    for (const shopId of shopIds) {
      if (!accessibleShopIds.includes(shopId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (startDateParam) {
      dateFilter.gte = new Date(startDateParam)
    }
    if (endDateParam) {
      const endOfDay = new Date(endDateParam)
      endOfDay.setHours(23, 59, 59, 999)
      dateFilter.lte = endOfDay
    }

    // Get data for each shop
    const shopReports: ShopReport[] = await Promise.all(
      shopIds.map(async (shopId) => {
        const shop = await prisma.shop.findUnique({
          where: { id: shopId },
          select: { id: true, name: true, parentId: true },
        })

        if (!shop) {
          throw new Error(`Shop ${shopId} not found`)
        }

        const responses = await prisma.response.findMany({
          where: {
            shopId,
            ...(Object.keys(dateFilter).length > 0 ? { submittedAt: dateFilter } : {}),
          },
          select: { answers: true },
        })

        const answers = responses.map(r => r.answers as ResponseAnswers)
        const categoryScores = calculateAllCategoryScores(answers)
        const overallScore = calculateOverallScore(answers)
        const enpsResult = calculateENPS(answers)

        return {
          shop,
          scores: {
            overall: overallScore,
            categories: categoryScores,
            enps: enpsResult.score,
          },
          responseCount: responses.length,
        }
      })
    )

    // Get industry benchmark
    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
      include: { company: true },
    })

    const benchmarks = await prisma.benchmark.findMany({
      where: { industry: admin?.company.industry },
    })

    const benchmarkMap: Record<string, number> = {}
    let benchmarkOverall = 0
    let benchmarkCount = 0
    for (const b of benchmarks) {
      benchmarkMap[b.category] = b.avgScore
      if (b.category !== 'ENPS' && b.category !== 'FREE_TEXT') {
        benchmarkOverall += b.avgScore
        benchmarkCount++
      }
    }
    if (benchmarkCount > 0) {
      benchmarkMap.overall = benchmarkOverall / benchmarkCount
    }

    // Calculate rankings
    const rankings = calculateRankings(shopReports)

    // Find biggest gaps
    const gaps = findBiggestGaps(shopReports)

    // Check for low response warnings
    const warnings = shopReports
      .filter(r => r.responseCount < 5 && r.responseCount > 0)
      .map(r => ({
        shopId: r.shop.id,
        shopName: r.shop.name,
        responseCount: r.responseCount,
        message: `${r.shop.name} は回答数が少ないため、参考値となります`,
      }))

    return NextResponse.json({
      shops: shopReports,
      benchmark: benchmarkMap,
      rankings,
      gaps,
      warnings,
    })
  } catch (error) {
    console.error('Error generating comparison:', error)
    return NextResponse.json(
      { error: 'Failed to generate comparison' },
      { status: 500 }
    )
  }
}
