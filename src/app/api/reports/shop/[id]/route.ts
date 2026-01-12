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

    // Fetch responses with comments
    const responses = await prisma.response.findMany({
      where: { shopId: { in: shopIds } },
      select: { answers: true, comment: true, submittedAt: true },
      orderBy: { submittedAt: 'desc' },
    })

    // Extract answers
    const answers = responses.map(r => r.answers as Record<string, number>)

    // Calculate scores
    const categoryScores = calculateAllCategoryScores(answers)
    const overallScore = calculateOverallScore(answers)
    const overallRisk = overallScore !== null ? getOverallRiskLevel(overallScore) : null
    const confidence = getConfidenceLevel(responses.length)

    // Calculate eNPS
    const enpsResult = calculateENPS(answers)
    const enpsRisk = getENPSRiskLevel(enpsResult.score)

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
    const categoryBreakdown = (Object.keys(categoryScores) as CategoryKey[]).map(category => {
      const score = categoryScores[category]
      const benchmark = benchmarkMap[category] ?? null
      const isReverse = REVERSE_SCORED_CATEGORIES.includes(category as typeof REVERSE_SCORED_CATEGORIES[number])
      const risk = score !== null ? getCategoryRiskLevel(score, isReverse) : null

      return {
        category,
        label: CATEGORY_LABELS[category],
        score,
        benchmark,
        difference: score !== null && benchmark !== null ? score - benchmark : null,
        risk,
        isReverse,
      }
    })

    return NextResponse.json({
      shop: {
        id: shop.id,
        name: shop.name,
        companyName: shop.company.name,
        industry: shop.company.industry,
      },
      includesChildren: includeChildren,
      shopCount: shopIds.length,
      responseCount: responses.length,
      overallScore,
      overallRisk,
      benchmarkOverall,
      categoryBreakdown,
      confidence,
      // eNPS data
      enps: {
        score: enpsResult.score,
        risk: enpsRisk,
        promoters: enpsResult.promoters,
        passives: enpsResult.passives,
        detractors: enpsResult.detractors,
        totalResponses: enpsResult.totalResponses,
        promoterPercentage: enpsResult.promoterPercentage,
        detractorPercentage: enpsResult.detractorPercentage,
      },
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
