import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const setupPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validation = setupPasswordSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { token, password } = validation.data

    // Find admin by token
    const admin = await prisma.admin.findUnique({
      where: { inviteToken: token },
    })

    if (!admin) {
      return NextResponse.json(
        { error: 'Invalid invite link' },
        { status: 400 }
      )
    }

    if (admin.inviteExpiry && admin.inviteExpiry < new Date()) {
      return NextResponse.json(
        { error: 'This invite link has expired' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Update admin: set password, activate account, clear token
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        passwordHash,
        status: 'ACTIVE',
        inviteToken: null,
        inviteExpiry: null,
      },
    })

    // Also update company status if it's still onboarding
    await prisma.company.updateMany({
      where: {
        id: admin.companyId,
        status: 'ONBOARDING',
      },
      data: {
        status: 'ACTIVE',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error setting password:', error)
    return NextResponse.json(
      { error: 'Failed to set password' },
      { status: 500 }
    )
  }
}
