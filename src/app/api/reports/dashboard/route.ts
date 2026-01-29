import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  calculateOverallScore,
  calculateAllCategoryScores,
  getOverallRiskLevel,
  calculateENPS,
  getENPSRiskLevel,
  REVERSE_SCORED_CATEGORIES,
} from '@/lib/scoring'

// GET /api/reports/dashboard - Get dashboard summary for admin
export async function GET() {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get admin info with shop assignments
    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
      include: {
        shopAssignments: {
          include: { shop: true },
        },
        company: true,
      },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Get accessible shop IDs
    let accessibleShopIds: string[]

    if (admin.isFullAccess) {
      // Full access: all shops in company
      const shops = await prisma.shop.findMany({
        where: { companyId: admin.companyId },
        select: { id: true },
      })
      accessibleShopIds = shops.map(s => s.id)
    } else {
      // Limited access: assigned shops and their descendants
      const assignedShopIds = admin.shopAssignments.map(a => a.shopId)
      accessibleShopIds = [...assignedShopIds]

      // Get all descendants
      const getDescendants = async (parentIds: string[]) => {
        if (parentIds.length === 0) return
        const children = await prisma.shop.findMany({
          where: { parentId: { in: parentIds } },
          select: { id: true },
        })
        const childIds = children.map(c => c.id)
        accessibleShopIds.push(...childIds)
        await getDescendants(childIds)
      }

      await getDescendants(assignedShopIds)
    }

    // Get shops with stats
    const shops = await prisma.shop.findMany({
      where: { id: { in: accessibleShopIds } },
      include: {
        _count: {
          select: { responses: true },
        },
      },
    })

    const totalShops = shops.length
    const activeShops = shops.filter(s => s.status === 'ACTIVE').length

    // Get all responses for accessible shops
    const responses = await prisma.response.findMany({
      where: { shopId: { in: accessibleShopIds } },
      select: {
        id: true,
        shopId: true,
        answers: true,
        enpsScore: true,
        comment: true,
        submittedAt: true,
        shop: {
          select: { name: true },
        },
      },
      orderBy: { submittedAt: 'desc' },
    })

    const totalResponses = responses.length

    // Calculate overall score across all responses
    const allAnswers = responses.map(r => r.answers as Record<string, number>)
    const overallScore = calculateOverallScore(allAnswers)
    const overallRisk = overallScore !== null ? getOverallRiskLevel(overallScore) : null

    // Calculate eNPS
    const enpsResult = calculateENPS(responses.map(r => ({
      answers: r.answers as Record<string, number>,
      enpsScore: r.enpsScore,
    })))
    const enpsRisk = getENPSRiskLevel(enpsResult.score)

    // Get recent responses (last 10)
    const recentResponses = responses.slice(0, 10).map(r => ({
      id: r.id,
      shopId: r.shopId,
      shopName: r.shop.name,
      submittedAt: r.submittedAt,
    }))

    // Get recent comments (last 10)
    const recentComments = responses
      .filter(r => r.comment && r.comment.trim().length > 0)
      .slice(0, 10)
      .map(r => ({
        text: r.comment!,
        shopName: r.shop.name,
        submittedAt: r.submittedAt,
      }))

    // Calculate per-shop scores and find lowest scoring shops
    const shopScores: Array<{
      id: string
      name: string
      responseCount: number
      overallScore: number | null
      risk: ReturnType<typeof getOverallRiskLevel> | null
    }> = []

    for (const shop of shops) {
      const shopResponses = responses.filter(r => r.shopId === shop.id)
      const shopAnswers = shopResponses.map(r => r.answers as Record<string, number>)
      const score = calculateOverallScore(shopAnswers)

      shopScores.push({
        id: shop.id,
        name: shop.name,
        responseCount: shopResponses.length,
        overallScore: score,
        risk: score !== null ? getOverallRiskLevel(score) : null,
      })
    }

    // Sort by score (lowest first), filter out shops with no responses
    const shopsWithScores = shopScores.filter(s => s.overallScore !== null)
    shopsWithScores.sort((a, b) => (a.overallScore ?? 5) - (b.overallScore ?? 5))

    const lowestScoringShops = shopsWithScores.slice(0, 5)
    const highestScoringShops = [...shopsWithScores].sort(
      (a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0)
    ).slice(0, 5)

    // Count shops by risk level
    const riskCounts = {
      CRITICAL: 0,
      WARNING: 0,
      CAUTION: 0,
      STABLE: 0,
      EXCELLENT: 0,
      NO_DATA: 0,
    }

    for (const shop of shopScores) {
      if (shop.risk === null) {
        riskCounts.NO_DATA++
      } else {
        riskCounts[shop.risk.level as keyof typeof riskCounts]++
      }
    }

    // Get industry benchmarks
    const benchmarks = await prisma.benchmark.findMany({
      where: { industryId: admin.company.industryId },
    })

    const benchmarkMap: Record<string, number> = {}
    for (const b of benchmarks) {
      benchmarkMap[b.category] = b.avgScore
    }

    // Calculate benchmark overall score (excluding reverse scored)
    const nonReverseBenchmarks = benchmarks.filter(
      b => !REVERSE_SCORED_CATEGORIES.includes(b.category as typeof REVERSE_SCORED_CATEGORIES[number])
    )
    const benchmarkOverall = nonReverseBenchmarks.length > 0
      ? nonReverseBenchmarks.reduce((a, b) => a + b.avgScore, 0) / nonReverseBenchmarks.length
      : null

    // Calculate category scores for all responses
    const categoryScores = calculateAllCategoryScores(allAnswers)

    return NextResponse.json({
      summary: {
        totalShops,
        activeShops,
        totalResponses,
        overallScore,
        overallRisk,
        benchmarkOverall,
      },
      categoryScores,
      benchmarks: benchmarkMap,
      riskCounts,
      recentResponses,
      lowestScoringShops,
      highestScoringShops,
      company: {
        name: admin.company.name,
        industryId: admin.company.industryId,
      },
      // eNPS data
      enps: {
        score: enpsResult.score,
        risk: enpsRisk,
        promoters: enpsResult.promoters,
        passives: enpsResult.passives,
        detractors: enpsResult.detractors,
        totalResponses: enpsResult.totalResponses,
      },
      // Comments
      recentComments,
      totalComments: responses.filter(r => r.comment && r.comment.trim().length > 0).length,
    })
  } catch (error) {
    console.error('Error fetching dashboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
