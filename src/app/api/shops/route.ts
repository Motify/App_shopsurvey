import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import crypto from 'crypto'

function generateShortId(length: number = 8): string {
  return crypto.randomBytes(length).toString('base64url').substring(0, length)
}

const createShopSchema = z.object({
  name: z.string().min(1, 'Shop name is required'),
  shopNumber: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
})

// GET /api/shops - List shops for the company
export async function GET() {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
      include: {
        shopAssignments: {
          include: { shop: true },
        },
      },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    let shops

    if (admin.isFullAccess) {
      // Full access: get all shops for the company
      shops = await prisma.shop.findMany({
        where: { companyId: admin.companyId },
        include: {
          _count: {
            select: { responses: true, children: true },
          },
          parent: {
            select: { id: true, name: true },
          },
        },
        orderBy: { name: 'asc' },
      })
    } else {
      // Limited access: only assigned shops and their children
      const assignedShopIds = admin.shopAssignments.map((a) => a.shopId)

      // Get assigned shops and all their descendants
      const allAccessibleShopIds = new Set<string>(assignedShopIds)

      // Recursively get all children
      const getChildrenIds = async (parentIds: string[]): Promise<string[]> => {
        if (parentIds.length === 0) return []
        const children = await prisma.shop.findMany({
          where: { parentId: { in: parentIds } },
          select: { id: true },
        })
        const childIds = children.map((c) => c.id)
        childIds.forEach((id) => allAccessibleShopIds.add(id))
        if (childIds.length > 0) {
          await getChildrenIds(childIds)
        }
        return childIds
      }

      await getChildrenIds(assignedShopIds)

      shops = await prisma.shop.findMany({
        where: { id: { in: Array.from(allAccessibleShopIds) } },
        include: {
          _count: {
            select: { responses: true, children: true },
          },
          parent: {
            select: { id: true, name: true },
          },
        },
        orderBy: { name: 'asc' },
      })
    }

    return NextResponse.json(shops)
  } catch (error) {
    console.error('Error fetching shops:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shops' },
      { status: 500 }
    )
  }
}

// POST /api/shops - Create a new shop
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Only full access admins can create shops
    if (!admin.isFullAccess) {
      return NextResponse.json(
        { error: 'Only full access admins can create shops' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = createShopSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, shopNumber, parentId, address } = validation.data

    // Validate parent shop if provided
    if (parentId) {
      const parentShop = await prisma.shop.findUnique({
        where: { id: parentId },
      })

      if (!parentShop || parentShop.companyId !== admin.companyId) {
        return NextResponse.json(
          { error: 'Invalid parent shop' },
          { status: 400 }
        )
      }
    }

    // Generate unique QR code
    const qrCode = `SH-${generateShortId(8)}`

    const shop = await prisma.shop.create({
      data: {
        name,
        shopNumber: shopNumber || null,
        parentId: parentId || null,
        address: address || null,
        qrCode,
        companyId: admin.companyId,
      },
      include: {
        _count: {
          select: { responses: true, children: true },
        },
        parent: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(shop, { status: 201 })
  } catch (error) {
    console.error('Error creating shop:', error)
    return NextResponse.json(
      { error: 'Failed to create shop' },
      { status: 500 }
    )
  }
}
