import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'No token provided' },
        { status: 400 }
      )
    }

    const admin = await prisma.admin.findUnique({
      where: { inviteToken: token },
    })

    if (!admin) {
      return NextResponse.json(
        { valid: false, error: 'Invalid invite link' },
        { status: 400 }
      )
    }

    if (admin.inviteExpiry && admin.inviteExpiry < new Date()) {
      return NextResponse.json(
        { valid: false, error: 'This invite link has expired' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      valid: true,
      email: admin.email,
    })
  } catch (error) {
    console.error('Error validating token:', error)
    return NextResponse.json(
      { valid: false, error: 'Failed to validate token' },
      { status: 500 }
    )
  }
}
