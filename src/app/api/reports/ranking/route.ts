import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  CATEGORY_LABELS,
  CATEGORY_MAPPING,
  CategoryKey,
} from '@/lib/scoring'

interface CompanyScore {
  companyId: string
  overall: number | null
  categories: Record<string, number | null>
  enps: number | null
  responseCount: number
}

// GET /api/reports/ranking - Get company ranking among all companies
export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    // Get admin's company
    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
      include: { company: { include: { industry: true } } },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Build date filter conditions for raw SQL
    let dateCondition = ''
    const dateParams: (string | Date)[] = []
    let paramIndex = 1

    if (startDateParam) {
      paramIndex++
      dateCondition += ` AND r.submitted_at >= $${paramIndex}`
      dateParams.push(new Date(startDateParam))
    }
    if (endDateParam) {
      const endOfDay = new Date(endDateParam)
      endOfDay.setHours(23, 59, 59, 999)
      paramIndex++
      dateCondition += ` AND r.submitted_at <= $${paramIndex}`
      dateParams.push(endOfDay)
    }

    // Get all ACTIVE companies with their aggregated scores
    // This aggregates all responses per company
    const query = `
      SELECT
        c.id as company_id,
        COUNT(r.id)::int as response_count,
        AVG((r.answers->>'q1')::float8)::float8 as avg_q1,
        AVG((r.answers->>'q2')::float8)::float8 as avg_q2,
        AVG((r.answers->>'q3')::float8)::float8 as avg_q3,
        AVG((r.answers->>'q4')::float8)::float8 as avg_q4,
        AVG((r.answers->>'q5')::float8)::float8 as avg_q5,
        AVG((r.answers->>'q6')::float8)::float8 as avg_q6,
        AVG((r.answers->>'q7')::float8)::float8 as avg_q7,
        AVG((r.answers->>'q8')::float8)::float8 as avg_q8,
        AVG((r.answers->>'q9')::float8)::float8 as avg_q9,
        AVG((r.answers->>'q10')::float8)::float8 as avg_q10,
        COUNT(CASE WHEN r.enps_score >= 9 THEN 1 END)::int as promoters,
        COUNT(CASE WHEN r.enps_score IS NOT NULL AND r.enps_score <= 6 THEN 1 END)::int as detractors,
        COUNT(CASE WHEN r.enps_score IS NOT NULL THEN 1 END)::int as enps_total
      FROM companies c
      LEFT JOIN shops s ON s.company_id = c.id AND s.status = 'ACTIVE'
      LEFT JOIN responses r ON r.shop_id = s.id ${dateCondition ? 'AND 1=1 ' + dateCondition : ''}
      WHERE c.status = 'ACTIVE'
      GROUP BY c.id
      HAVING COUNT(r.id) > 0
      ORDER BY c.id
    `

    const results = await prisma.$queryRawUnsafe<Array<{
      company_id: string
      response_count: number
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
    }>>(query, ...dateParams)

    // Calculate scores for each company
    const companyScores: CompanyScore[] = results.map(row => {
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

      // Calculate eNPS
      const promoters = row.promoters ?? 0
      const detractors = row.detractors ?? 0
      const enpsTotal = row.enps_total ?? 0
      const enps = enpsTotal > 0
        ? Math.round(((promoters - detractors) / enpsTotal) * 100)
        : null

      return {
        companyId: row.company_id,
        overall: overallScore,
        categories: categoryScores,
        enps,
        responseCount: row.response_count,
      }
    })

    // Only include companies with valid scores
    const validCompanies = companyScores.filter(c => c.overall !== null)
    const totalCompanies = validCompanies.length

    // Find the current company's scores
    const myCompany = validCompanies.find(c => c.companyId === admin.companyId)

    if (!myCompany) {
      return NextResponse.json({
        totalCompanies: 0,
        myRanking: null,
        message: 'まだ回答データがありません',
      })
    }

    // Calculate overall ranking
    const sortedByOverall = [...validCompanies]
      .filter(c => c.overall !== null)
      .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))

    const overallRank = sortedByOverall.findIndex(c => c.companyId === admin.companyId) + 1
    const overallPercentile = totalCompanies > 1
      ? Math.round(((totalCompanies - overallRank) / (totalCompanies - 1)) * 100)
      : 100

    // Calculate category rankings
    const categoryRankings: Record<string, {
      rank: number
      total: number
      percentile: number
      score: number | null
    }> = {}

    const categories = Object.keys(CATEGORY_LABELS).filter(k => k !== 'ENPS' && k !== 'FREE_TEXT') as CategoryKey[]

    for (const category of categories) {
      const companiesWithCategory = validCompanies.filter(c => c.categories[category] !== null)
      const sortedByCategory = [...companiesWithCategory]
        .sort((a, b) => (b.categories[category] ?? 0) - (a.categories[category] ?? 0))

      const categoryRank = sortedByCategory.findIndex(c => c.companyId === admin.companyId) + 1
      const categoryTotal = sortedByCategory.length
      const categoryPercentile = categoryTotal > 1
        ? Math.round(((categoryTotal - categoryRank) / (categoryTotal - 1)) * 100)
        : 100

      categoryRankings[category] = {
        rank: categoryRank > 0 ? categoryRank : 0,
        total: categoryTotal,
        percentile: categoryRank > 0 ? categoryPercentile : 0,
        score: myCompany.categories[category],
      }
    }

    // Calculate eNPS ranking
    const companiesWithENPS = validCompanies.filter(c => c.enps !== null)
    const sortedByENPS = [...companiesWithENPS]
      .sort((a, b) => (b.enps ?? -100) - (a.enps ?? -100))

    const enpsRank = sortedByENPS.findIndex(c => c.companyId === admin.companyId) + 1
    const enpsTotal = sortedByENPS.length
    const enpsPercentile = enpsTotal > 1
      ? Math.round(((enpsTotal - enpsRank) / (enpsTotal - 1)) * 100)
      : 100

    // Get industry benchmark
    const benchmarks = await prisma.benchmark.findMany({
      where: { industryId: admin.company.industryId },
    })

    const benchmarkMap: Record<string, number> = {}
    let benchmarkOverall = 0
    let benchmarkCount = 0
    for (const b of benchmarks) {
      benchmarkMap[b.category] = b.avgScore
      // Only include driver categories (not outcome measures like ENPS and RETENTION_INTENTION)
      if (b.category !== 'ENPS' && b.category !== 'RETENTION_INTENTION') {
        benchmarkOverall += b.avgScore
        benchmarkCount++
      }
    }
    if (benchmarkCount > 0) {
      benchmarkMap.overall = benchmarkOverall / benchmarkCount
    }

    return NextResponse.json({
      totalCompanies,
      myRanking: {
        overall: {
          rank: overallRank,
          total: totalCompanies,
          percentile: overallPercentile,
          score: myCompany.overall,
        },
        categories: categoryRankings,
        enps: {
          rank: enpsRank > 0 ? enpsRank : null,
          total: enpsTotal,
          percentile: enpsRank > 0 ? enpsPercentile : 0,
          score: myCompany.enps,
        },
        responseCount: myCompany.responseCount,
      },
      benchmark: benchmarkMap,
      industry: admin.company.industry.code,
      industryName: admin.company.industry.nameJa,
    })
  } catch (error) {
    console.error('Error generating ranking:', error)
    return NextResponse.json(
      { error: 'Failed to generate ranking' },
      { status: 500 }
    )
  }
}
