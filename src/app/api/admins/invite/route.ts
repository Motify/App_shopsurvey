import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendAdminInvite } from '@/lib/mailgun'
import { z } from 'zod'
import crypto from 'crypto'

const inviteSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  isFullAccess: z.boolean().optional().default(false),
  shopIds: z.array(z.string()).optional().default([]),
})

// POST /api/admins/invite - Invite new admin (Full Access only)
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
      include: { company: true },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    if (!admin.isFullAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const validation = inviteSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, email, isFullAccess, shopIds } = validation.data

    // Check if email already exists
    const existing = await prisma.admin.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      )
    }

    // Validate shop IDs if provided
    let validShopIds: string[] = []
    if (shopIds.length > 0 && !isFullAccess) {
      const validShops = await prisma.shop.findMany({
        where: { id: { in: shopIds }, companyId: admin.companyId },
        select: { id: true },
      })
      validShopIds = validShops.map((s) => s.id)
    }

    const inviteToken = crypto.randomUUID()
    const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Create admin and assignments in transaction
    const newAdmin = await prisma.$transaction(async (tx) => {
      const created = await tx.admin.create({
        data: {
          companyId: admin.companyId,
          email,
          name,
          isFullAccess,
          status: 'PENDING',
          inviteToken,
          inviteExpiry,
        },
      })

      if (validShopIds.length > 0) {
        await tx.adminShopAssignment.createMany({
          data: validShopIds.map((shopId) => ({
            adminId: created.id,
            shopId,
          })),
        })
      }

      return created
    })

    // Send invite email
    try {
      await sendAdminInvite(email, name, admin.company.name, inviteToken)
    } catch (emailError) {
      console.error('Failed to send invite email:', emailError)
      // Don't fail the request if email fails - admin is created
    }

    return NextResponse.json({ success: true, admin: newAdmin }, { status: 201 })
  } catch (error) {
    console.error('Error inviting admin:', error)
    return NextResponse.json(
      { error: 'Failed to invite admin' },
      { status: 500 }
    )
  }
}
