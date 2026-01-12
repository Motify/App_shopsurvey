import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateShopSchema = z.object({
  name: z.string().min(1, 'Shop name is required').optional(),
  parentId: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

// Helper to check if admin has access to a shop
async function hasAccessToShop(adminId: string, shopId: string): Promise<boolean> {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: {
      shopAssignments: true,
    },
  })

  if (!admin) return false
  if (admin.isFullAccess) return true

  // Check if shop is in assigned shops or their children
  const assignedShopIds = admin.shopAssignments.map((a) => a.shopId)
  const allAccessibleShopIds = new Set<string>(assignedShopIds)

  const getChildrenIds = async (parentIds: string[]): Promise<void> => {
    if (parentIds.length === 0) return
    const children = await prisma.shop.findMany({
      where: { parentId: { in: parentIds } },
      select: { id: true },
    })
    const childIds = children.map((c) => c.id)
    childIds.forEach((id) => allAccessibleShopIds.add(id))
    if (childIds.length > 0) {
      await getChildrenIds(childIds)
    }
  }

  await getChildrenIds(assignedShopIds)
  return allAccessibleShopIds.has(shopId)
}

// Helper to check for circular parent reference
async function wouldCreateCircle(shopId: string, newParentId: string): Promise<boolean> {
  if (shopId === newParentId) return true

  // Check if newParentId is a descendant of shopId
  const descendants = new Set<string>()

  const getDescendants = async (parentId: string): Promise<void> => {
    const children = await prisma.shop.findMany({
      where: { parentId },
      select: { id: true },
    })
    for (const child of children) {
      descendants.add(child.id)
      await getDescendants(child.id)
    }
  }

  await getDescendants(shopId)
  return descendants.has(newParentId)
}

// GET /api/shops/[id] - Get a single shop
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    const shop = await prisma.shop.findUnique({
      where: { id },
      include: {
        _count: {
          select: { responses: true, children: true },
        },
        parent: {
          select: { id: true, name: true },
        },
        children: {
          select: { id: true, name: true, status: true },
          orderBy: { name: 'asc' },
        },
      },
    })

    if (!shop || shop.companyId !== admin.companyId) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    // Check access for limited admins
    if (!admin.isFullAccess) {
      const hasAccess = await hasAccessToShop(admin.id, id)
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    return NextResponse.json(shop)
  } catch (error) {
    console.error('Error fetching shop:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shop' },
      { status: 500 }
    )
  }
}

// PATCH /api/shops/[id] - Update a shop
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Only full access admins can update shops
    if (!admin.isFullAccess) {
      return NextResponse.json(
        { error: 'Only full access admins can update shops' },
        { status: 403 }
      )
    }

    const shop = await prisma.shop.findUnique({
      where: { id },
    })

    if (!shop || shop.companyId !== admin.companyId) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    const body = await request.json()
    const validation = updateShopSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, parentId, address, status } = validation.data

    // Validate parent if changing
    if (parentId !== undefined && parentId !== null) {
      const parentShop = await prisma.shop.findUnique({
        where: { id: parentId },
      })

      if (!parentShop || parentShop.companyId !== admin.companyId) {
        return NextResponse.json(
          { error: 'Invalid parent shop' },
          { status: 400 }
        )
      }

      // Check for circular reference
      if (await wouldCreateCircle(id, parentId)) {
        return NextResponse.json(
          { error: 'Cannot set parent: would create circular reference' },
          { status: 400 }
        )
      }
    }

    const updatedShop = await prisma.shop.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(parentId !== undefined && { parentId }),
        ...(address !== undefined && { address }),
        ...(status !== undefined && { status }),
      },
      include: {
        _count: {
          select: { responses: true, children: true },
        },
        parent: {
          select: { id: true, name: true },
        },
        children: {
          select: { id: true, name: true, status: true },
          orderBy: { name: 'asc' },
        },
      },
    })

    return NextResponse.json(updatedShop)
  } catch (error) {
    console.error('Error updating shop:', error)
    return NextResponse.json(
      { error: 'Failed to update shop' },
      { status: 500 }
    )
  }
}

// DELETE /api/shops/[id] - Delete a shop (sets to INACTIVE)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Only full access admins can delete shops
    if (!admin.isFullAccess) {
      return NextResponse.json(
        { error: 'Only full access admins can delete shops' },
        { status: 403 }
      )
    }

    const shop = await prisma.shop.findUnique({
      where: { id },
      include: { _count: { select: { children: true } } },
    })

    if (!shop || shop.companyId !== admin.companyId) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    // Check if shop has children
    if (shop._count.children > 0) {
      return NextResponse.json(
        { error: 'Cannot delete shop with child shops. Remove or reassign children first.' },
        { status: 400 }
      )
    }

    // Soft delete - set to INACTIVE instead of actually deleting
    await prisma.shop.update({
      where: { id },
      data: { status: 'INACTIVE' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting shop:', error)
    return NextResponse.json(
      { error: 'Failed to delete shop' },
      { status: 500 }
    )
  }
}
