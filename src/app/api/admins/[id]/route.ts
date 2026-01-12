import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateAdminSchema = z.object({
  name: z.string().min(1).optional(),
  isFullAccess: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

// GET /api/admins/[id] - Get admin details
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
        shopAssignments: {
          include: { shop: { select: { id: true, name: true } } },
        },
      },
    })

    if (!targetAdmin || targetAdmin.companyId !== currentAdmin.companyId) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    return NextResponse.json(targetAdmin)
  } catch (error) {
    console.error('Error fetching admin:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin' },
      { status: 500 }
    )
  }
}

// PUT /api/admins/[id] - Update admin details
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
    const validation = updateAdminSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const targetAdmin = await prisma.admin.findUnique({
      where: { id: targetAdminId },
    })

    if (!targetAdmin || targetAdmin.companyId !== currentAdmin.companyId) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Prevent demoting yourself from full access
    if (
      targetAdminId === currentAdmin.id &&
      validation.data.isFullAccess === false
    ) {
      return NextResponse.json(
        { error: 'Cannot remove your own full access' },
        { status: 400 }
      )
    }

    const updated = await prisma.admin.update({
      where: { id: targetAdminId },
      data: validation.data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating admin:', error)
    return NextResponse.json(
      { error: 'Failed to update admin' },
      { status: 500 }
    )
  }
}
