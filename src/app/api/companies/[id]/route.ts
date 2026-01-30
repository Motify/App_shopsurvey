import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  industryId: z.string().min(1).optional(),
  status: z.enum(['ONBOARDING', 'ACTIVE', 'INACTIVE']).optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'sysadmin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        admins: {
          orderBy: { createdAt: 'asc' },
        },
        shops: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            shops: true,
            admins: true,
          },
        },
      },
    })

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(company)
  } catch (error) {
    console.error('Error fetching company:', error)
    return NextResponse.json(
      { error: 'Failed to fetch company' },
      { status: 500 }
    )
  }
}

// PATCH /api/companies/[id] - Update company
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

    const validation = updateCompanySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, industryId, status } = validation.data

    // Verify company exists
    const existingCompany = await prisma.company.findUnique({
      where: { id },
    })

    if (!existingCompany) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // If industryId is being changed, verify it exists
    if (industryId) {
      const industry = await prisma.industryType.findUnique({
        where: { id: industryId },
      })

      if (!industry) {
        return NextResponse.json(
          { error: 'Invalid industry selected' },
          { status: 400 }
        )
      }
    }

    // Update company
    const updatedCompany = await prisma.company.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(industryId && { industryId }),
        ...(status && { status }),
      },
      include: {
        industry: true,
      },
    })

    return NextResponse.json(updatedCompany)
  } catch (error) {
    console.error('Error updating company:', error)
    return NextResponse.json(
      { error: 'Failed to update company' },
      { status: 500 }
    )
  }
}
