import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { checkRateLimit, getClientIP, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit'
import { logAuthEvent, AuditAction } from '@/lib/audit'

// Password complexity requirements
const passwordSchema = z
  .string()
  .min(8, 'パスワードは8文字以上必要です')
  .regex(/[A-Z]/, 'パスワードには大文字を含めてください')
  .regex(/[a-z]/, 'パスワードには小文字を含めてください')
  .regex(/[0-9]/, 'パスワードには数字を含めてください')
  .regex(/[^A-Za-z0-9]/, 'パスワードには特殊文字を含めてください')

const setupPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
})

export async function POST(request: Request) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const rateLimit = checkRateLimit(`setup-password:${clientIP}`, RATE_LIMITS.passwordSetup)
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit.resetTime)
  }

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

    // Audit log
    await logAuthEvent(
      AuditAction.PASSWORD_CHANGED,
      request,
      admin.email,
      true,
      admin.id
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error setting password:', error)
    return NextResponse.json(
      { error: 'Failed to set password' },
      { status: 500 }
    )
  }
}
