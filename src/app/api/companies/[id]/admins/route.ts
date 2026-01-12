import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendAdminInvite } from '@/lib/mailgun'
import { z } from 'zod'
import crypto from 'crypto'

const addAdminSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  isFullAccess: z.boolean().optional().default(false),
})

export async function POST(
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

    const { id: companyId } = await params

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validation = addAdminSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { name, email, isFullAccess } = validation.data

    // Check if admin email already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
    })

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'An admin with this email already exists' },
        { status: 400 }
      )
    }

    // Generate invite token
    const inviteToken = crypto.randomUUID()
    const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const admin = await prisma.admin.create({
      data: {
        companyId,
        email,
        name,
        isFullAccess,
        status: 'PENDING',
        inviteToken,
        inviteExpiry,
      },
    })

    // Send invite email
    try {
      await sendAdminInvite(email, name, company.name, inviteToken)
    } catch (emailError) {
      console.error('Failed to send invite email:', emailError)
    }

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
    })
  } catch (error) {
    console.error('Error adding admin:', error)
    return NextResponse.json(
      { error: 'Failed to add admin' },
      { status: 500 }
    )
  }
}
