import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  calculateOverallScore,
  calculateAllCategoryScores,
  getOverallRiskLevel,
  calculateENPS,
  getENPSRiskLevel,
  CATEGORY_LABELS,
  CategoryKey,
  REVERSE_SCORED_CATEGORIES,
} from '@/lib/scoring'
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

function formatDate(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// GET /api/reports/company/pdf - Generate company-wide PDF report
export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Only full access admins can generate company-wide report
    if (!admin.isFullAccess) {
      return NextResponse.json(
        { error: 'Full access required for company-wide report' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const startDate = startDateParam ? new Date(startDateParam) : undefined
    const endDate = endDateParam ? new Date(endDateParam) : undefined

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (startDate) dateFilter.gte = startDate
    if (endDate) {
      const endOfDay = new Date(endDate)
      endOfDay.setHours(23, 59, 59, 999)
      dateFilter.lte = endOfDay
    }

    // Get all company shops
    const shops = await prisma.shop.findMany({
      where: { companyId: admin.companyId },
      include: {
        responses: {
          where: Object.keys(dateFilter).length > 0 ? { submittedAt: dateFilter } : undefined,
          select: { answers: true },
        },
      },
    })

    // Get all responses for company
    const allResponses = await prisma.response.findMany({
      where: {
        shop: { companyId: admin.companyId },
        ...(Object.keys(dateFilter).length > 0 ? { submittedAt: dateFilter } : {}),
      },
      select: { answers: true },
    })

    const allAnswers = allResponses.map(r => r.answers as Record<string, number>)
    const overallScore = calculateOverallScore(allAnswers)
    const categoryScores = calculateAllCategoryScores(allAnswers)
    const enpsResult = calculateENPS(allAnswers)

    // Get benchmarks
    const benchmarks = await prisma.benchmark.findMany({
      where: { industry: admin.company.industry },
    })
    const benchmarkMap: Record<string, number> = {}
    for (const b of benchmarks) {
      benchmarkMap[b.category] = b.avgScore
    }

    // Calculate shop scores
    const shopScores: Array<{
      name: string
      responseCount: number
      overallScore: number | null
      risk: { level: string; label: string } | null
    }> = []

    for (const shop of shops) {
      const shopAnswers = shop.responses.map(r => r.answers as Record<string, number>)
      const score = calculateOverallScore(shopAnswers)

      shopScores.push({
        name: shop.name,
        responseCount: shop.responses.length,
        overallScore: score,
        risk: score !== null ? getOverallRiskLevel(score) : null,
      })
    }

    // Sort for rankings
    const shopsWithScores = shopScores.filter(s => s.overallScore !== null)
    const lowestShops = [...shopsWithScores]
      .sort((a, b) => (a.overallScore ?? 5) - (b.overallScore ?? 5))
      .slice(0, 10)
    const highestShops = [...shopsWithScores]
      .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))
      .slice(0, 10)

    // Count risk levels
    const riskCounts = { CRITICAL: 0, WARNING: 0, CAUTION: 0, STABLE: 0, EXCELLENT: 0, NO_DATA: 0 }
    for (const shop of shopScores) {
      if (shop.risk === null) {
        riskCounts.NO_DATA++
      } else {
        riskCounts[shop.risk.level as keyof typeof riskCounts]++
      }
    }

    // Generate PDF
    const doc = new jsPDF()
    doc.setFont('helvetica')

    // Header
    doc.setFontSize(18)
    doc.text('Company-Wide Employee Retention Report', 105, 20, { align: 'center' })
    doc.setFontSize(10)
    doc.text('全社従業員定着度レポート', 105, 27, { align: 'center' })

    // Company info
    doc.setFontSize(11)
    doc.text(`Company: ${admin.company.name}`, 20, 40)
    doc.text(`Industry: ${admin.company.industry}`, 20, 47)

    const periodLabel = startDate && endDate
      ? `Period: ${formatDate(startDate)} - ${formatDate(endDate)}`
      : 'Period: All Time'
    doc.text(periodLabel, 20, 54)
    doc.text(`Generated: ${formatDate(new Date())}`, 20, 61)

    // Summary stats
    doc.setFontSize(14)
    doc.text('Summary', 20, 75)

    doc.setFontSize(10)
    doc.text(`Total Shops: ${shops.length}`, 20, 85)
    doc.text(`Total Responses: ${allResponses.length}`, 80, 85)
    doc.text(`Overall Score: ${overallScore?.toFixed(2) ?? '-'}`, 140, 85)

    // Risk Distribution
    doc.setFontSize(12)
    doc.text('Risk Distribution', 20, 100)

    doc.setFontSize(9)
    const riskY = 108
    doc.text(`Critical: ${riskCounts.CRITICAL}`, 20, riskY)
    doc.text(`Warning: ${riskCounts.WARNING}`, 55, riskY)
    doc.text(`Caution: ${riskCounts.CAUTION}`, 90, riskY)
    doc.text(`Stable: ${riskCounts.STABLE}`, 125, riskY)
    doc.text(`Excellent: ${riskCounts.EXCELLENT}`, 160, riskY)

    // eNPS
    doc.setFontSize(12)
    doc.text('eNPS (Employee Net Promoter Score)', 20, 122)

    doc.setFontSize(16)
    const enpsText = enpsResult.score !== null
      ? (enpsResult.score >= 0 ? `+${enpsResult.score}` : `${enpsResult.score}`)
      : '-'
    doc.text(enpsText, 20, 132)

    doc.setFontSize(9)
    if (enpsResult.score !== null) {
      const enpsRisk = getENPSRiskLevel(enpsResult.score)
      doc.text(`Status: ${enpsRisk.label}`, 50, 132)
    }
    doc.text(`Promoters: ${enpsResult.promoters}  Passives: ${enpsResult.passives}  Detractors: ${enpsResult.detractors}`, 20, 140)

    // Category Scores Table
    doc.setFontSize(12)
    doc.text('Category Breakdown', 20, 155)

    const categoryHead = [['Category', 'Score', 'Benchmark', 'Diff']]
    const categoryBody = (Object.keys(categoryScores) as CategoryKey[]).map(category => {
      const score = categoryScores[category]
      const benchmark = benchmarkMap[category] ?? null
      const diff = score !== null && benchmark !== null ? score - benchmark : null

      return [
        CATEGORY_LABELS[category].en,
        score !== null ? score.toFixed(2) : '-',
        benchmark !== null ? benchmark.toFixed(2) : '-',
        diff !== null ? (diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)) : '-',
      ]
    })

    doc.autoTable({
      startY: 160,
      head: categoryHead,
      body: categoryBody,
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 0, 0] },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 25, halign: 'center' as const },
        2: { cellWidth: 25, halign: 'center' as const },
        3: { cellWidth: 25, halign: 'center' as const },
      },
    })

    // Add new page for rankings
    doc.addPage()

    // Lowest Scoring Shops
    doc.setFontSize(14)
    doc.text('Shops Needing Attention (Lowest Scores)', 20, 20)

    if (lowestShops.length > 0) {
      const lowHead = [['Rank', 'Shop Name', 'Responses', 'Score', 'Status']]
      const lowBody = lowestShops.map((shop, i) => [
        `${i + 1}`,
        shop.name,
        `${shop.responseCount}`,
        shop.overallScore?.toFixed(2) ?? '-',
        shop.risk?.label ?? '-',
      ])

      doc.autoTable({
        startY: 25,
        head: lowHead,
        body: lowBody,
        theme: 'striped',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [220, 53, 69] },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' as const },
          1: { cellWidth: 70 },
          2: { cellWidth: 25, halign: 'center' as const },
          3: { cellWidth: 25, halign: 'center' as const },
          4: { cellWidth: 35, halign: 'center' as const },
        },
      })
    }

    // Highest Scoring Shops
    const afterLowTable = lowestShops.length > 0 ? doc.lastAutoTable.finalY + 20 : 40
    doc.setFontSize(14)
    doc.text('Top Performing Shops (Highest Scores)', 20, afterLowTable)

    if (highestShops.length > 0) {
      const highHead = [['Rank', 'Shop Name', 'Responses', 'Score', 'Status']]
      const highBody = highestShops.map((shop, i) => [
        `${i + 1}`,
        shop.name,
        `${shop.responseCount}`,
        shop.overallScore?.toFixed(2) ?? '-',
        shop.risk?.label ?? '-',
      ])

      doc.autoTable({
        startY: afterLowTable + 5,
        head: highHead,
        body: highBody,
        theme: 'striped',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [40, 167, 69] },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' as const },
          1: { cellWidth: 70 },
          2: { cellWidth: 25, halign: 'center' as const },
          3: { cellWidth: 25, halign: 'center' as const },
          4: { cellWidth: 35, halign: 'center' as const },
        },
      })
    }

    // All Shops List (if not too many)
    if (shopScores.length <= 30) {
      const afterHighTable = highestShops.length > 0 ? doc.lastAutoTable.finalY + 20 : afterLowTable + 20

      // Check if we need a new page
      if (afterHighTable > 200) {
        doc.addPage()
        doc.setFontSize(14)
        doc.text('All Shops Overview', 20, 20)

        const allHead = [['Shop Name', 'Responses', 'Score', 'Status']]
        const allBody = [...shopScores]
          .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))
          .map(shop => [
            shop.name,
            `${shop.responseCount}`,
            shop.overallScore?.toFixed(2) ?? '-',
            shop.risk?.label ?? 'No Data',
          ])

        doc.autoTable({
          startY: 25,
          head: allHead,
          body: allBody,
          theme: 'grid',
          styles: { fontSize: 8 },
          headStyles: { fillColor: [0, 0, 0] },
          columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 25, halign: 'center' as const },
            2: { cellWidth: 25, halign: 'center' as const },
            3: { cellWidth: 40, halign: 'center' as const },
          },
        })
      }
    }

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(128)
      doc.text('人事CREW - Employee Engagement Survey System', 105, 285, { align: 'center' })
      doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' })
    }

    // Generate PDF buffer
    const pdfOutput = doc.output('arraybuffer')

    // Return PDF
    return new Response(pdfOutput, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="company-report-${admin.company.name}-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating company PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
