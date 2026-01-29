import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateIndustrySchema = z.object({
  nameJa: z.string().min(1).max(100).optional(),
  nameEn: z.string().min(1).max(100).optional(),
})

// GET /api/industries/[id] - Get a single industry
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const industry = await prisma.industryType.findUnique({
      where: { id },
      include: {
        _count: {
          select: { companies: true, benchmarks: true },
        },
      },
    })

    if (!industry) {
      return NextResponse.json({ error: 'Industry not found' }, { status: 404 })
    }

    return NextResponse.json(industry)
  } catch (error) {
    console.error('Error fetching industry:', error)
    return NextResponse.json(
      { error: 'Failed to fetch industry' },
      { status: 500 }
    )
  }
}

// PATCH /api/industries/[id] - Update an industry
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validation = updateIndustrySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const industry = await prisma.industryType.findUnique({
      where: { id },
    })

    if (!industry) {
      return NextResponse.json({ error: 'Industry not found' }, { status: 404 })
    }

    const updated = await prisma.industryType.update({
      where: { id },
      data: validation.data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating industry:', error)
    return NextResponse.json(
      { error: 'Failed to update industry' },
      { status: 500 }
    )
  }
}

// DELETE /api/industries/[id] - Delete an industry
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'sysadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const industry = await prisma.industryType.findUnique({
      where: { id },
      include: {
        _count: {
          select: { companies: true },
        },
      },
    })

    if (!industry) {
      return NextResponse.json({ error: 'Industry not found' }, { status: 404 })
    }

    // Prevent deletion of default industries
    if (industry.isDefault) {
      return NextResponse.json(
        { error: 'デフォルト業種は削除できません' },
        { status: 400 }
      )
    }

    // Prevent deletion if companies are using this industry
    if (industry._count.companies > 0) {
      return NextResponse.json(
        { error: `この業種は ${industry._count.companies} 社で使用中のため削除できません` },
        { status: 400 }
      )
    }

    // Delete industry and its benchmarks (cascade)
    await prisma.industryType.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting industry:', error)
    return NextResponse.json(
      { error: 'Failed to delete industry' },
      { status: 500 }
    )
  }
}
