import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccessibleShopIds } from '@/lib/access'
import {
  CATEGORY_LABELS,
  CATEGORY_MAPPING,
  CategoryKey,
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

interface ShopNode {
  id: string
  name: string
  parentId: string | null
}

// Build descendant map from flat shop list (in-memory, no extra queries)
function buildDescendantMap(shops: ShopNode[]): Map<string, string[]> {
  const childrenMap = new Map<string, string[]>()

  // Build parent -> children mapping
  for (const shop of shops) {
    if (shop.parentId) {
      const siblings = childrenMap.get(shop.parentId) || []
      siblings.push(shop.id)
      childrenMap.set(shop.parentId, siblings)
    }
  }

  // For each shop, recursively collect all descendants
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

// Calculate rankings for shops
function calculateRankings(shopReports: ShopReport[]) {
  const withData = shopReports.filter(r => r.scores.overall !== null)
  const withoutData = shopReports.filter(r => r.scores.overall === null)

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
      return NextResponse.json({ error: '最低2事業所を選択してください' }, { status: 400 })
    }

    if (shopIds.length > 5) {
      return NextResponse.json({ error: '最大5事業所まで選択できます' }, { status: 400 })
    }

    // Verify access and get admin info in one query
    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
      include: { company: true },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Get ALL company shops in ONE query
    const allCompanyShops = await prisma.shop.findMany({
      where: { companyId: admin.companyId },
      select: { id: true, name: true, parentId: true },
    })

    // Build descendant map in memory (no additional queries)
    const descendantMap = buildDescendantMap(allCompanyShops)

    // Verify access to all requested shops
    const { shopIds: accessibleShopIds } = await getAccessibleShopIds(session.user.id)
    for (const shopId of shopIds) {
      if (!accessibleShopIds.includes(shopId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Build date filter conditions for raw SQL
    let dateCondition = ''
    const dateParams: (string | Date)[] = []
    if (startDateParam) {
      dateCondition += ` AND r.submitted_at >= $2`
      dateParams.push(new Date(startDateParam))
    }
    if (endDateParam) {
      const endOfDay = new Date(endDateParam)
      endOfDay.setHours(23, 59, 59, 999)
      const paramIndex = dateParams.length + 2
      dateCondition += ` AND r.submitted_at <= $${paramIndex}`
      dateParams.push(endOfDay)
    }

    // For each selected shop, get all shop IDs to aggregate (self + descendants)
    const shopToAggregateIds = new Map<string, string[]>()
    for (const shopId of shopIds) {
      const descendants = descendantMap.get(shopId) || []
      shopToAggregateIds.set(shopId, [shopId, ...descendants])
    }

    // Use database aggregation for each shop group - much faster than fetching all rows
    const shopReports: ShopReport[] = await Promise.all(
      shopIds.map(async (shopId) => {
        const shop = allCompanyShops.find(s => s.id === shopId)
        if (!shop) {
          throw new Error(`Shop ${shopId} not found`)
        }

        const aggregateShopIds = shopToAggregateIds.get(shopId)!

        // Use raw SQL for database-level aggregation
        // This is MUCH faster than fetching thousands of rows
        const query = `
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
            COUNT(CASE WHEN enps_score >= 9 THEN 1 END)::int as promoters,
            COUNT(CASE WHEN enps_score IS NOT NULL AND enps_score <= 6 THEN 1 END)::int as detractors,
            COUNT(CASE WHEN enps_score IS NOT NULL THEN 1 END)::int as enps_total
          FROM responses r
          WHERE r.shop_id = ANY($1::text[])
          ${dateCondition}
        `
        const result = await prisma.$queryRawUnsafe<Array<{
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
          avg_q10: number | null
          promoters: number
          detractors: number
          enps_total: number
        }>>(query, aggregateShopIds, ...dateParams)

        const row = result[0]
        const responseCount = row?.count ?? 0

        if (responseCount === 0) {
          return {
            shop: { id: shop.id, name: shop.name, parentId: shop.parentId },
            scores: {
              overall: null,
              categories: Object.fromEntries(
                Object.keys(CATEGORY_MAPPING).map(k => [k, null])
              ),
              enps: null,
            },
            responseCount: 0,
          }
        }

        // Calculate category scores from averages
        const categoryScores: Record<string, number | null> = {}
        for (const [category, questions] of Object.entries(CATEGORY_MAPPING)) {
          const questionAvgs = questions.map(q => {
            const key = `avg_${q}` as keyof typeof row
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
        const detractors = row.detractors ?? 0
        const enpsTotal = row.enps_total ?? 0
        const enps = enpsTotal > 0
          ? Math.round(((promoters - detractors) / enpsTotal) * 100)
          : null

        return {
          shop: { id: shop.id, name: shop.name, parentId: shop.parentId },
          scores: {
            overall: overallScore,
            categories: categoryScores,
            enps,
          },
          responseCount,
        }
      })
    )

    // Get industry benchmark
    const benchmarks = await prisma.benchmark.findMany({
      where: { industry: admin.company.industry },
    })

    const benchmarkMap: Record<string, number> = {}
    let benchmarkOverall = 0
    let benchmarkCount = 0
    for (const b of benchmarks) {
      benchmarkMap[b.category] = b.avgScore
      // Exclude ENPS and outcome measures from overall benchmark calculation
      if (b.category !== 'ENPS' && b.category !== 'RETENTION_INTENTION') {
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
