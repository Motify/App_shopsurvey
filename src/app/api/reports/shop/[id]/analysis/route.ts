import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAccessibleShopIds } from '@/lib/access'
import { analyzeResponses, AnalysisResult } from '@/lib/ai-analysis'

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

// GET /api/reports/shop/[id]/analysis - Get AI analysis for shop responses
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
    const forceRefresh = searchParams.get('refresh') === 'true'

    // Date filtering
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const startDate = startDateParam ? new Date(startDateParam) : new Date(0) // Default to epoch start
    const endDate = endDateParam ? new Date(endDateParam) : new Date() // Default to now

    // Verify access
    const { shopIds: accessibleShopIds } = await getAccessibleShopIds(session.user.id)
    if (!accessibleShopIds.includes(shopId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get shop IDs to include
    let shopIds = [shopId]
    if (includeChildren) {
      const descendantIds = await getDescendantShopIds(shopId)
      shopIds = [...shopIds, ...descendantIds]
    }

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (startDateParam) dateFilter.gte = startDate
    if (endDateParam) {
      const endOfDay = new Date(endDate)
      endOfDay.setHours(23, 59, 59, 999)
      dateFilter.lte = endOfDay
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await prisma.responseAnalysis.findUnique({
        where: {
          shopId_startDate_endDate: {
            shopId,
            startDate,
            endDate,
          },
        },
      })

      if (cached) {
        // Check if cache is still valid (has same or more responses)
        const currentResponseCount = await prisma.response.count({
          where: {
            shopId: { in: shopIds },
            OR: [
              { positiveText: { not: null } },
              { improvementText: { not: null } },
            ],
            ...(Object.keys(dateFilter).length > 0 ? { submittedAt: dateFilter } : {}),
          },
        })

        // If we have the same or fewer responses, use cache
        if (currentResponseCount <= cached.responseCount) {
          const analysis = cached.analysis as unknown as AnalysisResult
          return NextResponse.json({
            ...analysis,
            responseCount: cached.responseCount,
            cached: true,
            cachedAt: cached.createdAt,
          })
        }
      }
    }

    // Fetch responses with text
    const responses = await prisma.response.findMany({
      where: {
        shopId: { in: shopIds },
        OR: [
          { positiveText: { not: null } },
          { improvementText: { not: null } },
        ],
        ...(Object.keys(dateFilter).length > 0 ? { submittedAt: dateFilter } : {}),
      },
      select: {
        positiveText: true,
        improvementText: true,
      },
    })

    // Need minimum responses for meaningful analysis
    if (responses.length < 5) {
      return NextResponse.json({
        error: 'Not enough responses',
        message: '分析には最低5件のテキスト回答が必要です',
        responseCount: responses.length,
        minRequired: 5,
      }, { status: 400 })
    }

    const positiveTexts = responses
      .map(r => r.positiveText)
      .filter((t): t is string => t !== null && t.trim().length > 0)
    const improvementTexts = responses
      .map(r => r.improvementText)
      .filter((t): t is string => t !== null && t.trim().length > 0)

    // Run AI analysis
    const analysis = await analyzeResponses(positiveTexts, improvementTexts)

    // Cache the result
    await prisma.responseAnalysis.upsert({
      where: {
        shopId_startDate_endDate: {
          shopId,
          startDate,
          endDate,
        },
      },
      update: {
        responseCount: responses.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        analysis: analysis as any,
        createdAt: new Date(),
      },
      create: {
        shopId,
        startDate,
        endDate,
        responseCount: responses.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        analysis: analysis as any,
      },
    })

    return NextResponse.json({
      ...analysis,
      responseCount: responses.length,
      positiveCount: positiveTexts.length,
      improvementCount: improvementTexts.length,
      cached: false,
    })
  } catch (error) {
    console.error('Error generating analysis:', error)
    return NextResponse.json(
      { error: 'Failed to generate analysis' },
      { status: 500 }
    )
  }
}
