import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createIndustrySchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z_]+$/, 'Code must be uppercase letters and underscores only'),
  nameJa: z.string().min(1).max(100),
  nameEn: z.string().min(1).max(100),
})

// GET /api/industries - List all industries
export async function GET() {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const industries = await prisma.industryType.findMany({
      orderBy: [
        { isDefault: 'desc' },
        { nameJa: 'asc' },
      ],
      include: {
        _count: {
          select: { companies: true, benchmarks: true },
        },
      },
    })

    return NextResponse.json(industries)
  } catch (error) {
    console.error('Error fetching industries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch industries' },
      { status: 500 }
    )
  }
}

// POST /api/industries - Create a new industry
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createIndustrySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { code, nameJa, nameEn } = validation.data

    // Check for duplicate code
    const existing = await prisma.industryType.findUnique({
      where: { code },
    })

    if (existing) {
      return NextResponse.json(
        { error: `業種コード「${code}」は既に存在します` },
        { status: 400 }
      )
    }

    const industry = await prisma.industryType.create({
      data: {
        code,
        nameJa,
        nameEn,
        isDefault: false,
      },
    })

    return NextResponse.json(industry, { status: 201 })
  } catch (error) {
    console.error('Error creating industry:', error)
    return NextResponse.json(
      { error: 'Failed to create industry' },
      { status: 500 }
    )
  }
}
