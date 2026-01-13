import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  calculateAllCategoryScores,
  calculateOverallScore,
  getOverallRiskLevel,
  getCategoryRiskLevel,
  getConfidenceLevel,
  calculateENPS,
  getENPSRiskLevel,
  CATEGORY_LABELS,
  CategoryKey,
  REVERSE_SCORED_CATEGORIES,
  ResponseAnswers,
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

// Helper to calculate scores from responses
function calculateScoresFromResponses(responses: { answers: unknown; comment: string | null; submittedAt: Date }[]) {
  const answers = responses.map(r => r.answers as ResponseAnswers)
  const categoryScores = calculateAllCategoryScores(answers)
  const overallScore = calculateOverallScore(answers)
  const enpsResult = calculateENPS(answers)

  return {
    categoryScores,
    overallScore,
    enpsResult,
    responseCount: responses.length,
  }
}

// Helper to calculate changes between two periods
function calculateChanges(
  currentScores: ReturnType<typeof calculateScoresFromResponses>,
  previousScores: ReturnType<typeof calculateScoresFromResponses>
) {
  const overallChange = currentScores.overallScore !== null && previousScores.overallScore !== null
    ? {
        value: currentScores.overallScore - previousScores.overallScore,
        direction: currentScores.overallScore > previousScores.overallScore ? 'up' as const :
                   currentScores.overallScore < previousScores.overallScore ? 'down' as const : 'same' as const,
        percentage: previousScores.overallScore !== 0
          ? ((currentScores.overallScore - previousScores.overallScore) / previousScores.overallScore * 100)
          : null,
      }
    : null

  const categoryChanges: Record<CategoryKey, { value: number; direction: 'up' | 'down' | 'same' } | null> = {} as Record<CategoryKey, { value: number; direction: 'up' | 'down' | 'same' } | null>

  for (const category of Object.keys(currentScores.categoryScores) as CategoryKey[]) {
    const current = currentScores.categoryScores[category]
    const previous = previousScores.categoryScores[category]

    if (current !== null && previous !== null) {
      const diff = current - previous
      categoryChanges[category] = {
        value: diff,
        direction: diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'same',
      }
    } else {
      categoryChanges[category] = null
    }
  }

  const enpsChange = currentScores.enpsResult.score !== null && previousScores.enpsResult.score !== null
    ? {
        value: currentScores.enpsResult.score - previousScores.enpsResult.score,
        direction: currentScores.enpsResult.score > previousScores.enpsResult.score ? 'up' as const :
                   currentScores.enpsResult.score < previousScores.enpsResult.score ? 'down' as const : 'same' as const,
      }
    : null

  return {
    overall: overallChange,
    categories: categoryChanges,
    enps: enpsChange,
  }
}

// GET /api/reports/shop/[id] - Get report for a shop
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: shopId } = params
    const { searchParams } = new URL(request.url)
    const includeChildren = searchParams.get('includeChildren') === 'true'

    // Date filtering
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const startDate = startDateParam ? new Date(startDateParam) : undefined
    const endDate = endDateParam ? new Date(endDateParam) : undefined

    // Comparison period
    const compareStartParam = searchParams.get('compareStartDate')
    const compareEndParam = searchParams.get('compareEndDate')
    const compareStartDate = compareStartParam ? new Date(compareStartParam) : undefined
    const compareEndDate = compareEndParam ? new Date(compareEndParam) : undefined

    // Get admin info
    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
      include: {
        shopAssignments: true,
        company: true,
      },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Get shop info
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        company: true,
      },
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    // Verify access
    if (shop.companyId !== admin.companyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (!admin.isFullAccess) {
      const assignedShopIds = admin.shopAssignments.map(a => a.shopId)
      // Check if this shop or any of its ancestors is assigned
      let hasAccess = assignedShopIds.includes(shopId)

      if (!hasAccess) {
        // Check if any assigned shop is an ancestor of this shop
        let currentShop = shop
        while (currentShop.parentId && !hasAccess) {
          if (assignedShopIds.includes(currentShop.parentId)) {
            hasAccess = true
          } else {
            const parentShop = await prisma.shop.findUnique({
              where: { id: currentShop.parentId },
            })
            if (!parentShop) break
            currentShop = parentShop as typeof shop
          }
        }
      }

      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Get shop IDs to include in report
    let shopIds = [shopId]
    if (includeChildren) {
      const descendantIds = await getDescendantShopIds(shopId)
      shopIds = [...shopIds, ...descendantIds]
    }

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (startDate) dateFilter.gte = startDate
    if (endDate) {
      // Set end date to end of day
      const endOfDay = new Date(endDate)
      endOfDay.setHours(23, 59, 59, 999)
      dateFilter.lte = endOfDay
    }

    // Fetch current period responses
    const responses = await prisma.response.findMany({
      where: {
        shopId: { in: shopIds },
        ...(Object.keys(dateFilter).length > 0 ? { submittedAt: dateFilter } : {}),
      },
      select: { answers: true, comment: true, submittedAt: true },
      orderBy: { submittedAt: 'desc' },
    })

    // Calculate current period scores
    const currentScores = calculateScoresFromResponses(responses)
    const answers = responses.map(r => r.answers as ResponseAnswers)
    const overallRisk = currentScores.overallScore !== null ? getOverallRiskLevel(currentScores.overallScore) : null
    const confidence = getConfidenceLevel(responses.length)
    const enpsRisk = getENPSRiskLevel(currentScores.enpsResult.score)

    // Fetch and calculate comparison period if requested
    let comparison = null
    if (compareStartDate && compareEndDate) {
      const compareEndOfDay = new Date(compareEndDate)
      compareEndOfDay.setHours(23, 59, 59, 999)

      const previousResponses = await prisma.response.findMany({
        where: {
          shopId: { in: shopIds },
          submittedAt: {
            gte: compareStartDate,
            lte: compareEndOfDay,
          },
        },
        select: { answers: true, comment: true, submittedAt: true },
        orderBy: { submittedAt: 'desc' },
      })

      const previousScores = calculateScoresFromResponses(previousResponses)
      const changes = calculateChanges(currentScores, previousScores)

      comparison = {
        period: {
          startDate: compareStartDate,
          endDate: compareEndDate,
        },
        responseCount: previousResponses.length,
        overallScore: previousScores.overallScore,
        categoryScores: previousScores.categoryScores,
        enps: previousScores.enpsResult,
        changes,
      }
    }

    // Get comments (non-empty only)
    const comments = responses
      .filter(r => r.comment && r.comment.trim().length > 0)
      .map(r => ({
        text: r.comment!,
        submittedAt: r.submittedAt,
      }))

    // Get industry benchmark
    const benchmarks = await prisma.benchmark.findMany({
      where: { industry: shop.company.industry },
    })

    const benchmarkMap: Record<string, number> = {}
    for (const b of benchmarks) {
      benchmarkMap[b.category] = b.avgScore
    }

    // Calculate benchmark overall score (excluding reverse scored from average)
    const nonReverseBenchmarks = benchmarks.filter(
      b => !REVERSE_SCORED_CATEGORIES.includes(b.category as typeof REVERSE_SCORED_CATEGORIES[number])
    )
    const benchmarkOverall = nonReverseBenchmarks.length > 0
      ? nonReverseBenchmarks.reduce((a, b) => a + b.avgScore, 0) / nonReverseBenchmarks.length
      : null

    // Build category breakdown
    const categoryBreakdown = (Object.keys(currentScores.categoryScores) as CategoryKey[]).map(category => {
      const score = currentScores.categoryScores[category]
      const benchmark = benchmarkMap[category] ?? null
      const isReverse = REVERSE_SCORED_CATEGORIES.includes(category as typeof REVERSE_SCORED_CATEGORIES[number])
      const risk = score !== null ? getCategoryRiskLevel(score, isReverse) : null
      const change = comparison?.changes.categories[category] ?? null

      return {
        category,
        label: CATEGORY_LABELS[category],
        score,
        benchmark,
        difference: score !== null && benchmark !== null ? score - benchmark : null,
        risk,
        isReverse,
        change,
      }
    })

    return NextResponse.json({
      shop: {
        id: shop.id,
        name: shop.name,
        companyName: shop.company.name,
        industry: shop.company.industry,
      },
      period: startDate || endDate ? {
        startDate: startDate ?? null,
        endDate: endDate ?? null,
      } : null,
      includesChildren: includeChildren,
      shopCount: shopIds.length,
      responseCount: responses.length,
      overallScore: currentScores.overallScore,
      overallRisk,
      benchmarkOverall,
      categoryBreakdown,
      confidence,
      // eNPS data
      enps: {
        score: currentScores.enpsResult.score,
        risk: enpsRisk,
        promoters: currentScores.enpsResult.promoters,
        passives: currentScores.enpsResult.passives,
        detractors: currentScores.enpsResult.detractors,
        totalResponses: currentScores.enpsResult.totalResponses,
        promoterPercentage: currentScores.enpsResult.promoterPercentage,
        detractorPercentage: currentScores.enpsResult.detractorPercentage,
        change: comparison?.changes.enps ?? null,
      },
      // Comparison data
      comparison,
      // Comments summary
      comments: {
        total: comments.length,
        recent: comments.slice(0, 20), // Last 20 comments
      },
      recentResponses: responses.slice(0, 10).map(r => ({
        submittedAt: r.submittedAt,
      })),
    })
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
