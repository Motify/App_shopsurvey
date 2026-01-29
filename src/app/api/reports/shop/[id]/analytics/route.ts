import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccessibleShopIds } from '@/lib/access'
import {
  getCategoryRiskLevel,
  CATEGORY_LABELS,
  CategoryKey,
  CATEGORY_MAPPING,
  ResponseAnswers,
} from '@/lib/scoring'

// ===== Question Analysis =====

interface QuestionStat {
  questionId: string
  order: number
  textJa: string
  textEn: string
  category: string
  average: number | null
  median: number | null
  stdDev: number | null
  distribution: Record<number, number>
  responseCount: number
  riskLevel: { level: string; label: string; color: string } | null
}

function calculateQuestionStats(responses: ResponseAnswers[], questions: { id: string; order: number; textJa: string; textEn: string; category: string }[]): QuestionStat[] {
  return questions.map(q => {
    const key = `q${q.order}` as keyof ResponseAnswers
    const scores = responses
      .map(r => r[key])
      .filter((s): s is number => typeof s === 'number' && s >= 1 && s <= 5)

    if (scores.length === 0) {
      return {
        questionId: q.id,
        order: q.order,
        textJa: q.textJa,
        textEn: q.textEn,
        category: q.category,
        average: null,
        median: null,
        stdDev: null,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        responseCount: 0,
        riskLevel: null,
      }
    }

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    const sorted = [...scores].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]

    // Distribution
    const distribution = {
      1: scores.filter(s => s === 1).length,
      2: scores.filter(s => s === 2).length,
      3: scores.filter(s => s === 3).length,
      4: scores.filter(s => s === 4).length,
      5: scores.filter(s => s === 5).length,
    }

    // Standard deviation
    const stdDev = Math.sqrt(
      scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length
    )

    return {
      questionId: q.id,
      order: q.order,
      textJa: q.textJa,
      textEn: q.textEn,
      category: q.category,
      average: avg,
      median,
      stdDev,
      distribution,
      responseCount: scores.length,
      riskLevel: getCategoryRiskLevel(avg),
    }
  })
}

// ===== Correlation Analysis =====

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length
  if (n === 0) return 0

  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0)
  const sumX2 = x.reduce((total, xi) => total + xi * xi, 0)
  const sumY2 = y.reduce((total, yi) => total + yi * yi, 0)

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  )

  return denominator === 0 ? 0 : numerator / denominator
}

function calculateCorrelations(responses: ResponseAnswers[]) {
  const categories = Object.keys(CATEGORY_MAPPING) as CategoryKey[]

  // Calculate overall score for each response
  const dataPoints: Array<{ overall: number } & Record<CategoryKey, number>> = responses.map(r => {
    let total = 0
    let count = 0
    for (let i = 1; i <= 9; i++) {
      const val = r[`q${i}` as keyof ResponseAnswers]
      if (typeof val === 'number') {
        total += val
        count++
      }
    }
    const overall = count > 0 ? total / count : 0

    const categoryScores = {} as Record<CategoryKey, number>
    for (const category of categories) {
      const questions = CATEGORY_MAPPING[category]
      let catTotal = 0
      let catCount = 0
      for (const q of questions) {
        const val = r[q as keyof ResponseAnswers]
        if (typeof val === 'number') {
          catTotal += val
          catCount++
        }
      }
      categoryScores[category] = catCount > 0 ? catTotal / catCount : 0
    }

    return { overall, ...categoryScores }
  })

  // Calculate correlation of each category with overall score
  const correlations = categories.map(category => {
    const categoryValues = dataPoints.map(d => d[category])
    const overallValues = dataPoints.map(d => d.overall)
    const correlation = pearsonCorrelation(categoryValues, overallValues)

    return {
      category,
      categoryLabel: CATEGORY_LABELS[category],
      correlation,
      impact: Math.abs(correlation),
    }
  })

  return correlations.sort((a, b) => b.impact - a.impact)
}

function generateCorrelationInsight(correlations: ReturnType<typeof calculateCorrelations>) {
  if (correlations.length === 0) return null

  const top = correlations[0]
  return {
    ja: `この事業所では「${top.categoryLabel.ja}」が総合満足度に最も強く影響しています。この領域の改善が全体スコア向上に最も効果的です。`,
    en: `"${top.categoryLabel.en}" has the strongest impact on overall satisfaction. Improving this area will be most effective.`,
  }
}

// ===== Pattern Detection =====

interface Pattern {
  type: string
  severity: 'info' | 'warning' | 'error'
  title: string
  description: string
  metric: string
}

function detectResponsePatterns(responses: ResponseAnswers[]): Pattern[] {
  const patterns: Pattern[] = []

  if (responses.length < 5) return patterns

  // 1. Polarized responses (many 1s and 5s, few middle scores)
  const allScores: number[] = []
  for (const r of responses) {
    for (let i = 1; i <= 9; i++) {
      const val = r[`q${i}` as keyof ResponseAnswers]
      if (typeof val === 'number') {
        allScores.push(val)
      }
    }
  }

  if (allScores.length > 0) {
    const extremeCount = allScores.filter(s => s === 1 || s === 5).length
    const polarization = extremeCount / allScores.length

    if (polarization > 0.6) {
      patterns.push({
        type: 'POLARIZED',
        severity: 'warning',
        title: '意見の二極化',
        description: '従業員の意見が大きく分かれています。チーム内に異なる経験をしているグループがある可能性があります。',
        metric: `${(polarization * 100).toFixed(0)}%が極端な回答`,
      })
    }
  }

  // 2. All-same responses (low engagement or rushed)
  const suspiciousResponses = responses.filter(r => {
    const values: number[] = []
    for (let i = 1; i <= 9; i++) {
      const val = r[`q${i}` as keyof ResponseAnswers]
      if (typeof val === 'number') {
        values.push(val)
      }
    }
    return values.length > 0 && new Set(values).size === 1
  })

  if (suspiciousResponses.length / responses.length > 0.1) {
    patterns.push({
      type: 'LOW_ENGAGEMENT',
      severity: 'info',
      title: '低エンゲージメント回答の検出',
      description: '全問同じ回答をしている回答者がいます。回答の信頼性に注意が必要です。',
      metric: `${suspiciousResponses.length}件 (${((suspiciousResponses.length / responses.length) * 100).toFixed(0)}%)`,
    })
  }

  // 3. High standard deviation per category
  const categories = Object.keys(CATEGORY_MAPPING) as CategoryKey[]
  for (const category of categories) {
    const questions = CATEGORY_MAPPING[category]
    const categoryScores: number[] = []

    for (const r of responses) {
      let total = 0
      let count = 0
      for (const q of questions) {
        const val = r[q as keyof ResponseAnswers]
        if (typeof val === 'number') {
          total += val
          count++
        }
      }
      if (count > 0) {
        categoryScores.push(total / count)
      }
    }

    if (categoryScores.length >= 5) {
      const avg = categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length
      const stdDev = Math.sqrt(
        categoryScores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / categoryScores.length
      )

      if (stdDev > 1.2) {
        patterns.push({
          type: 'HIGH_VARIANCE',
          severity: 'warning',
          title: `${CATEGORY_LABELS[category].ja}のばらつきが大きい`,
          description: 'この領域で従業員間の経験に大きな差があります。特定のシフトや担当者による違いがある可能性があります。',
          metric: `標準偏差: ${stdDev.toFixed(2)}`,
        })
      }
    }
  }

  return patterns
}

// ===== Percentile Calculation =====

async function calculatePercentile(shopId: string, companyId: string) {
  // Get company industry
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { industry: true },
  })

  if (!company) return null

  // Get all shops in same industry with responses
  const allShops = await prisma.shop.findMany({
    where: {
      company: { industry: company.industry },
    },
    select: {
      id: true,
      responses: {
        select: { answers: true },
      },
    },
  })

  // Calculate overall score for each shop
  const shopScores = allShops
    .filter(shop => shop.responses.length >= 3) // Minimum responses
    .map(shop => {
      const answers = shop.responses.map(r => r.answers as ResponseAnswers)
      let total = 0
      let count = 0

      for (const a of answers) {
        for (let i = 1; i <= 9; i++) {
          const val = a[`q${i}` as keyof ResponseAnswers]
          if (typeof val === 'number') {
            total += val
            count++
          }
        }
      }

      return {
        shopId: shop.id,
        score: count > 0 ? total / count : 0,
      }
    })

  // Find this shop's score
  const thisShop = shopScores.find(s => s.shopId === shopId)
  if (!thisShop || shopScores.length < 2) return null

  // Calculate percentile
  const belowCount = shopScores.filter(s => s.score < thisShop.score).length
  const percentile = (belowCount / shopScores.length) * 100

  // Calculate rank
  const sortedShops = [...shopScores].sort((a, b) => b.score - a.score)
  const rank = sortedShops.findIndex(s => s.shopId === shopId) + 1

  return {
    percentile: Math.round(percentile),
    rank,
    totalShops: shopScores.length,
    score: thisShop.score,
  }
}

// ===== Main API Handler =====

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
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    // Verify access
    const { shopIds: accessibleShopIds } = await getAccessibleShopIds(session.user.id)
    if (!accessibleShopIds.includes(shopId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get shop info
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true, companyId: true },
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
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

    // Fetch responses
    const responses = await prisma.response.findMany({
      where: {
        shopId,
        ...(Object.keys(dateFilter).length > 0 ? { submittedAt: dateFilter } : {}),
      },
      select: { answers: true },
    })

    const answers = responses.map(r => r.answers as ResponseAnswers)
    const responseCount = responses.length

    // Minimum responses check
    if (responseCount < 3) {
      return NextResponse.json({
        error: 'Not enough data',
        message: '分析には最低3件の回答が必要です',
        responseCount,
      }, { status: 400 })
    }

    // Fetch questions
    const questions = await prisma.question.findMany({
      orderBy: { order: 'asc' },
      where: { order: { lte: 9 } }, // Only Q1-Q9 (not eNPS or free text)
    })

    // Calculate all analytics
    const questionStats = calculateQuestionStats(answers, questions)
    const byScore = [...questionStats].filter(q => q.average !== null).sort((a, b) => (a.average ?? 0) - (b.average ?? 0))

    // Correlations (need at least 10 responses)
    let correlations = null
    let correlationInsight = null
    if (responseCount >= 10) {
      correlations = calculateCorrelations(answers)
      correlationInsight = generateCorrelationInsight(correlations)
    }

    // Patterns
    const patterns = detectResponsePatterns(answers)

    // Percentile
    const percentile = await calculatePercentile(shopId, shop.companyId)

    return NextResponse.json({
      shop: {
        id: shop.id,
        name: shop.name,
      },
      responseCount,
      questions: {
        all: questionStats,
        lowestScoring: byScore.slice(0, 3),
        highestScoring: byScore.slice(-3).reverse(),
      },
      correlations: correlations ? {
        data: correlations,
        insight: correlationInsight,
        minResponses: 10,
      } : {
        data: null,
        insight: null,
        message: '相関分析には最低10件の回答が必要です',
        currentCount: responseCount,
        minResponses: 10,
      },
      patterns,
      percentile,
    })
  } catch (error) {
    console.error('Error generating analytics:', error)
    return NextResponse.json(
      { error: 'Failed to generate analytics' },
      { status: 500 }
    )
  }
}
