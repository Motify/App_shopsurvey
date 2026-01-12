import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/mailgun'
import { z } from 'zod'
import crypto from 'crypto'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validation = forgotPasswordSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { email } = validation.data

    // Find admin by email
    const admin = await prisma.admin.findUnique({
      where: { email },
      include: { company: true },
    })

    // Always return success to prevent email enumeration
    if (!admin) {
      return NextResponse.json({ success: true })
    }

    // Generate new reset token
    const inviteToken = crypto.randomUUID()
    const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Update admin with reset token
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        inviteToken,
        inviteExpiry,
      },
    })

    // Send reset email
    try {
      await sendPasswordResetEmail(email, admin.name, inviteToken)
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError)
      // Still return success to prevent email enumeration
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing forgot password:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
