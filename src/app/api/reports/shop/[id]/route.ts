import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getOverallRiskLevel,
  getCategoryRiskLevel,
  getConfidenceLevel,
  getENPSRiskLevel,
  getRetentionIntentionRiskLevel,
  CATEGORY_LABELS,
  CATEGORY_MAPPING,
  CategoryKey,
  REVERSE_SCORED_CATEGORIES,
} from '@/lib/scoring'

interface ShopNode {
  id: string
  parentId: string | null
}

// Build descendant map from flat shop list (in-memory, no extra queries)
function buildDescendantMap(shops: ShopNode[]): Map<string, string[]> {
  const childrenMap = new Map<string, string[]>()

  for (const shop of shops) {
    if (shop.parentId) {
      const siblings = childrenMap.get(shop.parentId) || []
      siblings.push(shop.id)
      childrenMap.set(shop.parentId, siblings)
    }
  }

  const descendantMap = new Map<string, string[]>()

  function getDescendants(shopId: string): string[] {
    if (descendantMap.has(shopId)) {
      return descendantMap.get(shopId)!
    }

    const children = childrenMap.get(shopId) || []
    const allDescendants: string[] = [...children]

    for (const childId of children) {
      allDescendants.push(...getDescendants(childId))
    }

    descendantMap.set(shopId, allDescendants)
    return allDescendants
  }

  for (const shop of shops) {
    getDescendants(shop.id)
  }

  return descendantMap
}

// Database aggregation result type
interface AggregationResult {
  count: number
  avg_q1: number | null
  avg_q2: number | null
  avg_q3: number | null
  avg_q4: number | null
  avg_q5: number | null
  avg_q6: number | null
  avg_q7: number | null
  avg_q8: number | null
  avg_q9: number | null
  avg_q10: number | null  // Retention Intention (1-5 scale)
  avg_enps: number | null // eNPS score (0-10 scale) from enps_score field
  promoters: number       // eNPS promoters (9-10)
  passives: number        // eNPS passives (7-8)
  detractors: number      // eNPS detractors (0-6)
}

// Calculate scores from aggregation result
function calculateScoresFromAggregation(row: AggregationResult | undefined) {
  const responseCount = row?.count ?? 0

  if (!row || responseCount === 0) {
    return {
      categoryScores: Object.fromEntries(
        Object.keys(CATEGORY_MAPPING).map(k => [k, null])
      ) as Record<CategoryKey, number | null>,
      overallScore: null,
      retentionIntention: null,
      enpsResult: {
        score: null,
        promoters: 0,
        passives: 0,
        detractors: 0,
        totalResponses: 0,
        promoterPercentage: null,
        detractorPercentage: null,
      },
      responseCount: 0,
    }
  }

  // Calculate category scores
  const categoryScores: Record<string, number | null> = {}
  for (const [category, questions] of Object.entries(CATEGORY_MAPPING)) {
    const questionAvgs = questions.map(q => {
      const key = `avg_${q}` as keyof AggregationResult
      const val = row[key]
      return typeof val === 'number' ? val : null
    }).filter((v): v is number => v !== null)

    categoryScores[category] = questionAvgs.length > 0
      ? questionAvgs.reduce((a, b) => a + b, 0) / questionAvgs.length
      : null
  }

  // Calculate overall score (Q1-Q9 average)
  const q1to9Avgs = [
    row.avg_q1, row.avg_q2, row.avg_q3, row.avg_q4, row.avg_q5,
    row.avg_q6, row.avg_q7, row.avg_q8, row.avg_q9
  ].filter((v): v is number => typeof v === 'number')

  const overallScore = q1to9Avgs.length > 0
    ? q1to9Avgs.reduce((a, b) => a + b, 0) / q1to9Avgs.length
    : null

  // Calculate eNPS (from enps_score field)
  const promoters = row.promoters ?? 0
  const passives = row.passives ?? 0
  const detractors = row.detractors ?? 0
  const totalWithENPS = promoters + passives + detractors

  const enpsScore = totalWithENPS > 0
    ? Math.round(((promoters - detractors) / totalWithENPS) * 100)
    : null

  const promoterPercentage = totalWithENPS > 0 ? (promoters / totalWithENPS) * 100 : null
  const detractorPercentage = totalWithENPS > 0 ? (detractors / totalWithENPS) * 100 : null

  // Get retention intention (Q10 average)
  const retentionIntention = typeof row.avg_q10 === 'number' ? row.avg_q10 : null

  return {
    categoryScores: categoryScores as Record<CategoryKey, number | null>,
    overallScore,
    retentionIntention,
    enpsResult: {
      score: enpsScore,
      promoters,
      passives,
      detractors,
      totalResponses: totalWithENPS,
      promoterPercentage,
      detractorPercentage,
    },
    responseCount,
  }
}

// Run aggregation query
async function runAggregationQuery(
  shopIds: string[],
  dateFilter?: { gte?: Date; lte?: Date }
): Promise<AggregationResult> {
  let dateCondition = ''
  const params: unknown[] = [shopIds]

  if (dateFilter?.gte) {
    dateCondition += ` AND r.submitted_at >= $2`
    params.push(dateFilter.gte)
  }
  if (dateFilter?.lte) {
    const paramIndex = params.length + 1
    dateCondition += ` AND r.submitted_at <= $${paramIndex}`
    params.push(dateFilter.lte)
  }

  const result = await prisma.$queryRawUnsafe<AggregationResult[]>(`
    SELECT
      COUNT(*)::int as count,
      AVG((answers->>'q1')::float8)::float8 as avg_q1,
      AVG((answers->>'q2')::float8)::float8 as avg_q2,
      AVG((answers->>'q3')::float8)::float8 as avg_q3,
      AVG((answers->>'q4')::float8)::float8 as avg_q4,
      AVG((answers->>'q5')::float8)::float8 as avg_q5,
      AVG((answers->>'q6')::float8)::float8 as avg_q6,
      AVG((answers->>'q7')::float8)::float8 as avg_q7,
      AVG((answers->>'q8')::float8)::float8 as avg_q8,
      AVG((answers->>'q9')::float8)::float8 as avg_q9,
      AVG((answers->>'q10')::float8)::float8 as avg_q10,
      AVG(enps_score::float8)::float8 as avg_enps,
      COUNT(CASE WHEN enps_score >= 9 THEN 1 END)::int as promoters,
      COUNT(CASE WHEN enps_score >= 7 AND enps_score <= 8 THEN 1 END)::int as passives,
      COUNT(CASE WHEN enps_score IS NOT NULL AND enps_score <= 6 THEN 1 END)::int as detractors
    FROM responses r
    WHERE r.shop_id = ANY($1::text[])
    ${dateCondition}
  `, ...params)

  return result[0]
}

// GET /api/reports/shop/[id] - Get report for a shop
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

    // Get admin info with company
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
      include: { company: true },
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    // Verify company access
    if (shop.companyId !== admin.companyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get ALL company shops in ONE query for descendant calculation
    const allCompanyShops = await prisma.shop.findMany({
      where: { companyId: admin.companyId },
      select: { id: true, parentId: true },
    })

    // Build descendant map in memory
    const descendantMap = buildDescendantMap(allCompanyShops)

    // Check access for non-full-access admins
    if (!admin.isFullAccess) {
      const assignedShopIds = admin.shopAssignments.map(a => a.shopId)
      let hasAccess = assignedShopIds.includes(shopId)

      if (!hasAccess) {
        // Check if any assigned shop is an ancestor
        let currentId: string | null = shop.parentId
        while (currentId && !hasAccess) {
          if (assignedShopIds.includes(currentId)) {
            hasAccess = true
          } else {
            const parent = allCompanyShops.find(s => s.id === currentId)
            currentId = parent?.parentId ?? null
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
      const descendantIds = descendantMap.get(shopId) || []
      shopIds = [shopId, ...descendantIds]
    }

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (startDate) dateFilter.gte = startDate
    if (endDate) {
      const endOfDay = new Date(endDate)
      endOfDay.setHours(23, 59, 59, 999)
      dateFilter.lte = endOfDay
    }

    // Run aggregation query (FAST - database does the calculation)
    const aggregationResult = await runAggregationQuery(
      shopIds,
      Object.keys(dateFilter).length > 0 ? dateFilter : undefined
    )

    const currentScores = calculateScoresFromAggregation(aggregationResult)
    const overallRisk = currentScores.overallScore !== null
      ? getOverallRiskLevel(currentScores.overallScore)
      : null
    const confidence = getConfidenceLevel(currentScores.responseCount)
    const enpsRisk = getENPSRiskLevel(currentScores.enpsResult.score)
    const retentionRisk = getRetentionIntentionRiskLevel(currentScores.retentionIntention)

    // Fetch comparison period if requested
    let comparison = null
    if (compareStartDate && compareEndDate) {
      const compareEndOfDay = new Date(compareEndDate)
      compareEndOfDay.setHours(23, 59, 59, 999)

      const compareResult = await runAggregationQuery(shopIds, {
        gte: compareStartDate,
        lte: compareEndOfDay,
      })

      const previousScores = calculateScoresFromAggregation(compareResult)

      // Calculate changes
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

      comparison = {
        period: {
          startDate: compareStartDate,
          endDate: compareEndDate,
        },
        responseCount: previousScores.responseCount,
        overallScore: previousScores.overallScore,
        categoryScores: previousScores.categoryScores,
        enps: previousScores.enpsResult,
        changes: {
          overall: overallChange,
          categories: categoryChanges,
          enps: enpsChange,
        },
      }
    }

    // Fetch only recent comments (limit 20) - separate lightweight query
    const recentComments = await prisma.response.findMany({
      where: {
        shopId: { in: shopIds },
        comment: { not: null },
        ...(Object.keys(dateFilter).length > 0 ? { submittedAt: dateFilter } : {}),
      },
      select: { comment: true, submittedAt: true },
      orderBy: { submittedAt: 'desc' },
      take: 20,
    })

    const comments = recentComments
      .filter(r => r.comment && r.comment.trim().length > 0)
      .map(r => ({
        text: r.comment!,
        submittedAt: r.submittedAt,
      }))

    // Get comment count separately (fast count query)
    const commentCount = await prisma.response.count({
      where: {
        shopId: { in: shopIds },
        comment: { not: null },
        ...(Object.keys(dateFilter).length > 0 ? { submittedAt: dateFilter } : {}),
      },
    })

    // Get industry benchmark
    const benchmarks = await prisma.benchmark.findMany({
      where: { industry: shop.company.industry },
    })

    const benchmarkMap: Record<string, number> = {}
    for (const b of benchmarks) {
      benchmarkMap[b.category] = b.avgScore
    }

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

    // Get recent response times (lightweight query)
    const recentResponses = await prisma.response.findMany({
      where: {
        shopId: { in: shopIds },
        ...(Object.keys(dateFilter).length > 0 ? { submittedAt: dateFilter } : {}),
      },
      select: { submittedAt: true },
      orderBy: { submittedAt: 'desc' },
      take: 10,
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
      responseCount: currentScores.responseCount,
      overallScore: currentScores.overallScore,
      overallRisk,
      benchmarkOverall,
      categoryBreakdown,
      confidence,
      retentionIntention: {
        score: currentScores.retentionIntention,
        risk: retentionRisk,
      },
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
      comparison,
      comments: {
        total: commentCount,
        recent: comments,
      },
      recentResponses: recentResponses.map(r => ({
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
