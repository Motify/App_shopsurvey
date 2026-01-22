import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/mailgun'
import crypto from 'crypto'

// POST /api/admins/[id]/reset-password - Send password reset email to admin
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    // Only full access admins or sysadmins can reset passwords
    if (!session || (session.user.role !== 'sysadmin' && !session.user.isFullAccess)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Get the admin to reset
    const admin = await prisma.admin.findUnique({
      where: { id },
      include: { company: true },
    })

    if (!admin) {
      return NextResponse.json(
        { error: 'Admin not found' },
        { status: 404 }
      )
    }

    // If current user is an admin (not sysadmin), check they're from the same company
    if (session.user.role === 'admin' && session.user.companyId !== admin.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized - different company' },
        { status: 403 }
      )
    }

    // Prevent resetting your own password through this endpoint
    if (session.user.id === admin.id) {
      return NextResponse.json(
        { error: 'Cannot reset your own password through this endpoint. Use the forgot password page instead.' },
        { status: 400 }
      )
    }

    // Generate new invite token for password reset
    const resetToken = crypto.randomUUID()
    const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Update admin with new token
    await prisma.admin.update({
      where: { id },
      data: {
        inviteToken: resetToken,
        inviteExpiry,
        // Keep status as is - they can still login until they use the reset link
      },
    })

    // Send password reset email
    await sendPasswordResetEmail(
      admin.email,
      admin.name,
      resetToken
    )

    return NextResponse.json({
      success: true,
      message: 'Password reset email sent successfully'
    })
  } catch (error) {
    console.error('Error sending password reset:', error)
    return NextResponse.json(
      { error: 'Failed to send password reset email' },
      { status: 500 }
    )
  }
}
