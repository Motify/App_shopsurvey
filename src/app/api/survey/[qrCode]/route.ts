import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/survey/[qrCode] - Get shop and questions for survey (public)
export async function GET(
  request: Request,
  { params }: { params: { qrCode: string } }
) {
  try {
    const { qrCode } = params

    // Find shop by QR code
    const shop = await prisma.shop.findUnique({
      where: { qrCode },
      select: {
        id: true,
        name: true,
        status: true,
        company: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!shop) {
      return NextResponse.json(
        { error: 'Survey not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (shop.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Survey is inactive', code: 'INACTIVE' },
        { status: 400 }
      )
    }

    // Fetch all questions ordered by order field
    const questions = await prisma.question.findMany({
      orderBy: { order: 'asc' },
      select: {
        id: true,
        order: true,
        textJa: true,
        textEn: true,
        category: true,
        questionType: true,
        isReverse: true,
      },
    })

    return NextResponse.json({
      shop: {
        id: shop.id,
        name: shop.name,
        companyName: shop.company.name,
      },
      questions,
    })
  } catch (error) {
    console.error('Error fetching survey:', error)
    return NextResponse.json(
      { error: 'Failed to fetch survey' },
      { status: 500 }
    )
  }
}
