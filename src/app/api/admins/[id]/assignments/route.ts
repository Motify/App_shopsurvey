import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const assignmentsSchema = z.object({
  shopIds: z.array(z.string()),
})

// GET /api/admins/[id]/assignments - Get admin's shop assignments
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentAdmin = await prisma.admin.findUnique({
      where: { id: session.user.id },
    })

    if (!currentAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    if (!currentAdmin.isFullAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id: targetAdminId } = await params

    const targetAdmin = await prisma.admin.findUnique({
      where: { id: targetAdminId },
      include: {
        shopAssignments: { select: { shopId: true } },
      },
    })

    if (!targetAdmin || targetAdmin.companyId !== currentAdmin.companyId) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    return NextResponse.json({
      shopIds: targetAdmin.shopAssignments.map((a) => a.shopId),
    })
  } catch (error) {
    console.error('Error fetching assignments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    )
  }
}

// PUT /api/admins/[id]/assignments - Update admin's shop assignments
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentAdmin = await prisma.admin.findUnique({
      where: { id: session.user.id },
    })

    if (!currentAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    if (!currentAdmin.isFullAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id: targetAdminId } = await params
    const body = await request.json()
    const validation = assignmentsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { shopIds } = validation.data

    const targetAdmin = await prisma.admin.findUnique({
      where: { id: targetAdminId },
    })

    if (!targetAdmin || targetAdmin.companyId !== currentAdmin.companyId) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Validate all shop IDs belong to the company
    const validShops = await prisma.shop.findMany({
      where: { id: { in: shopIds }, companyId: currentAdmin.companyId },
      select: { id: true },
    })

    const validShopIds = validShops.map((s) => s.id)

    // Delete existing and create new assignments in transaction
    await prisma.$transaction([
      prisma.adminShopAssignment.deleteMany({
        where: { adminId: targetAdminId },
      }),
      prisma.adminShopAssignment.createMany({
        data: validShopIds.map((shopId) => ({
          adminId: targetAdminId,
          shopId,
        })),
      }),
    ])

    return NextResponse.json({ success: true, shopIds: validShopIds })
  } catch (error) {
    console.error('Error updating assignments:', error)
    return NextResponse.json(
      { error: 'Failed to update assignments' },
      { status: 500 }
    )
  }
}
