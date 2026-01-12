import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendAdminInvite } from '@/lib/mailgun'
import crypto from 'crypto'

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

    const { id } = await params

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

    if (admin.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Admin has already set up their account' },
        { status: 400 }
      )
    }

    // Generate new invite token
    const inviteToken = crypto.randomUUID()
    const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    await prisma.admin.update({
      where: { id },
      data: {
        inviteToken,
        inviteExpiry,
      },
    })

    // Send invite email
    await sendAdminInvite(
      admin.email,
      admin.name,
      admin.company.name,
      inviteToken
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resending invite:', error)
    return NextResponse.json(
      { error: 'Failed to resend invite' },
      { status: 500 }
    )
  }
}
