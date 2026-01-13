import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccessibleShopIds } from '@/lib/access'
import {
  calculateAllCategoryScores,
  calculateOverallScore,
  getOverallRiskLevel,
  getCategoryRiskLevel,
  calculateENPS,
  getENPSRiskLevel,
  CATEGORY_LABELS,
  CategoryKey,
  REVERSE_SCORED_CATEGORIES,
  ResponseAnswers,
} from '@/lib/scoring'
import { analyzeResponses, AnalysisResult } from '@/lib/ai-analysis'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

// Extend jsPDF type for autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: {
      startY: number
      head: string[][]
      body: (string | number)[][]
      theme?: string
      styles?: Record<string, unknown>
      headStyles?: Record<string, unknown>
      columnStyles?: Record<number, Record<string, unknown>>
    }) => jsPDF
    lastAutoTable: { finalY: number }
  }
}

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

function formatDate(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getRiskLabel(score: number): string {
  const risk = getOverallRiskLevel(score)
  return risk.label
}

// GET /api/reports/shop/[id]/pdf - Generate PDF report
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

    // Verify access
    const { shopIds: accessibleShopIds } = await getAccessibleShopIds(session.user.id)
    if (!accessibleShopIds.includes(shopId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get shop info
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: { company: true },
    })

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    // Get shop IDs to include
    let shopIds = [shopId]
    if (includeChildren) {
      const descendantIds = await getDescendantShopIds(shopId)
      shopIds = [...shopIds, ...descendantIds]
    }

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (startDate) dateFilter.gte = startDate
    if (endDate) {
      const endOfDay = new Date(endDate)
      endOfDay.setHours(23, 59, 59, 999)
      dateFilter.lte = endOfDay
    }

    // Fetch responses
    const responses = await prisma.response.findMany({
      where: {
        shopId: { in: shopIds },
        ...(Object.keys(dateFilter).length > 0 ? { submittedAt: dateFilter } : {}),
      },
      select: { answers: true, comment: true, positiveText: true, improvementText: true, submittedAt: true },
      orderBy: { submittedAt: 'desc' },
    })

    const answers = responses.map(r => r.answers as ResponseAnswers)
    const categoryScores = calculateAllCategoryScores(answers)
    const overallScore = calculateOverallScore(answers)
    const enpsResult = calculateENPS(answers)

    // Get benchmarks
    const benchmarks = await prisma.benchmark.findMany({
      where: { industry: shop.company.industry },
    })
    const benchmarkMap: Record<string, number> = {}
    for (const b of benchmarks) {
      benchmarkMap[b.category] = b.avgScore
    }

    // Generate PDF
    const doc = new jsPDF()

    // Set font to support Japanese (use built-in font, limited Japanese support)
    doc.setFont('helvetica')

    // Header
    doc.setFontSize(18)
    doc.text('Employee Retention Report', 105, 20, { align: 'center' })
    doc.setFontSize(10)
    doc.text('従業員定着度レポート', 105, 27, { align: 'center' })

    // Shop info
    doc.setFontSize(11)
    const shopLabel = `Shop: ${shop.name}`
    doc.text(shopLabel, 20, 40)

    const periodLabel = startDate && endDate
      ? `Period: ${formatDate(startDate)} - ${formatDate(endDate)}`
      : 'Period: All Time'
    doc.text(periodLabel, 20, 47)

    doc.text(`Responses: ${responses.length}`, 20, 54)
    doc.text(`Generated: ${formatDate(new Date())}`, 20, 61)

    // Overall Score
    doc.setFontSize(14)
    doc.text('Overall Score', 20, 75)

    doc.setFontSize(28)
    const scoreText = overallScore !== null ? overallScore.toFixed(2) : '-'
    doc.text(scoreText, 20, 90)

    doc.setFontSize(10)
    if (overallScore !== null) {
      const riskLabel = getRiskLabel(overallScore)
      doc.text(`Status: ${riskLabel}`, 55, 90)
    }

    // Category Scores Table
    doc.setFontSize(12)
    doc.text('Category Breakdown', 20, 110)

    const tableHead = [['Category', 'Score', 'Benchmark', 'Diff', 'Status']]
    const tableBody = (Object.keys(categoryScores) as CategoryKey[]).map(category => {
      const score = categoryScores[category]
      const benchmark = benchmarkMap[category] ?? null
      const isReverse = REVERSE_SCORED_CATEGORIES.includes(category as typeof REVERSE_SCORED_CATEGORIES[number])
      const risk = score !== null ? getCategoryRiskLevel(score, isReverse) : null
      const diff = score !== null && benchmark !== null ? score - benchmark : null

      return [
        CATEGORY_LABELS[category].en,
        score !== null ? score.toFixed(2) : '-',
        benchmark !== null ? benchmark.toFixed(2) : '-',
        diff !== null ? (diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)) : '-',
        risk?.label ?? '-',
      ]
    })

    doc.autoTable({
      startY: 115,
      head: tableHead,
      body: tableBody,
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 25, halign: 'center' as const },
        2: { cellWidth: 25, halign: 'center' as const },
        3: { cellWidth: 25, halign: 'center' as const },
        4: { cellWidth: 30, halign: 'center' as const },
      },
    })

    // eNPS Section
    const afterTable = doc.lastAutoTable.finalY + 15
    doc.setFontSize(12)
    doc.text('Employee Net Promoter Score (eNPS)', 20, afterTable)

    doc.setFontSize(20)
    const enpsText = enpsResult.score !== null
      ? (enpsResult.score >= 0 ? `+${enpsResult.score}` : `${enpsResult.score}`)
      : '-'
    doc.text(enpsText, 20, afterTable + 15)

    doc.setFontSize(9)
    if (enpsResult.score !== null) {
      const enpsRisk = getENPSRiskLevel(enpsResult.score)
      doc.text(`Status: ${enpsRisk.label}`, 50, afterTable + 15)
    }

    doc.text(`Promoters (9-10): ${enpsResult.promoters}`, 20, afterTable + 25)
    doc.text(`Passives (7-8): ${enpsResult.passives}`, 70, afterTable + 25)
    doc.text(`Detractors (0-6): ${enpsResult.detractors}`, 120, afterTable + 25)

    // Improvement Areas
    const lowCategories = (Object.keys(categoryScores) as CategoryKey[])
      .filter(cat => {
        const score = categoryScores[cat]
        return score !== null && score <= 3.2
      })
      .sort((a, b) => (categoryScores[a] ?? 0) - (categoryScores[b] ?? 0))

    let currentY = afterTable + 40

    if (lowCategories.length > 0) {
      doc.setFontSize(12)
      doc.text('Areas for Improvement', 20, currentY)

      doc.setFontSize(9)
      lowCategories.slice(0, 5).forEach((cat, i) => {
        const score = categoryScores[cat]
        doc.text(
          `${i + 1}. ${CATEGORY_LABELS[cat].en} (${score?.toFixed(2)})`,
          25,
          currentY + 10 + i * 6
        )
      })
      currentY += 10 + lowCategories.slice(0, 5).length * 6 + 15
    }

    // AI Analysis Section (if text responses available)
    const positiveTexts = responses
      .map(r => r.positiveText)
      .filter((t): t is string => t !== null && t.trim().length > 0)
    const improvementTexts = responses
      .map(r => r.improvementText)
      .filter((t): t is string => t !== null && t.trim().length > 0)

    if (positiveTexts.length >= 5 || improvementTexts.length >= 5) {
      // Check if we need a new page
      if (currentY > 220) {
        doc.addPage()
        currentY = 20
      }

      doc.setFontSize(14)
      doc.setTextColor(0)
      doc.text('AI Comment Analysis', 20, currentY)
      currentY += 10

      try {
        // Try to get cached analysis first
        const cacheDate = startDate || new Date(0)
        const cacheEndDate = endDate || new Date()

        const cachedAnalysis = await prisma.responseAnalysis.findUnique({
          where: {
            shopId_startDate_endDate: {
              shopId,
              startDate: cacheDate,
              endDate: cacheEndDate,
            },
          },
        })

        let analysis: AnalysisResult | null = null

        if (cachedAnalysis) {
          analysis = cachedAnalysis.analysis as unknown as AnalysisResult
        } else if (positiveTexts.length >= 5 || improvementTexts.length >= 5) {
          // Generate fresh analysis
          analysis = await analyzeResponses(positiveTexts, improvementTexts)
        }

        if (analysis) {
          // Add summary
          doc.setFontSize(9)
          doc.text(analysis.summaryEn, 20, currentY, { maxWidth: 170 })
          currentY += 15

          // Top positive themes (max 3)
          if (analysis.positiveThemes.length > 0) {
            doc.setFontSize(11)
            doc.text('Top Positive Themes:', 20, currentY)
            currentY += 8

            doc.setFontSize(9)
            analysis.positiveThemes.slice(0, 3).forEach((theme, i) => {
              doc.text(`${i + 1}. ${theme.themeEn} (${theme.count} mentions)`, 25, currentY)
              currentY += 6
            })
            currentY += 5
          }

          // Top improvement themes (max 3)
          if (analysis.improvementThemes.length > 0) {
            doc.setFontSize(11)
            doc.text('Top Improvement Themes:', 20, currentY)
            currentY += 8

            doc.setFontSize(9)
            analysis.improvementThemes.slice(0, 3).forEach((theme, i) => {
              doc.text(`${i + 1}. ${theme.themeEn} (${theme.count} mentions)`, 25, currentY)
              currentY += 6
              // Add suggested action
              doc.setFontSize(8)
              doc.setTextColor(100)
              const actionLines = doc.splitTextToSize(`Action: ${theme.suggestedAction}`, 150)
              doc.text(actionLines, 30, currentY)
              currentY += actionLines.length * 4 + 2
              doc.setTextColor(0)
              doc.setFontSize(9)
            })
          }
        }
      } catch (analysisError) {
        console.error('Failed to include AI analysis in PDF:', analysisError)
        doc.setFontSize(9)
        doc.text('AI analysis not available', 20, currentY)
      }
    }

    // Footer (on all pages)
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(128)
      doc.text('ShopSurvey - Employee Engagement Survey System', 105, 285, { align: 'center' })
    }

    // Generate PDF buffer
    const pdfOutput = doc.output('arraybuffer')

    // Return PDF
    return new Response(pdfOutput, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${shop.name}-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
