import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendAdminInvite } from '@/lib/mailgun'
import { z } from 'zod'
import crypto from 'crypto'

const createCompanySchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  industryId: z.string().min(1, 'Industry is required'),
  adminName: z.string().min(1, 'Admin name is required'),
  adminEmail: z.string().email('Invalid email address'),
})

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'sysadmin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validation = createCompanySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { companyName, industryId, adminName, adminEmail } = validation.data

    // Check if industry exists
    const industry = await prisma.industryType.findUnique({
      where: { id: industryId },
    })

    if (!industry) {
      return NextResponse.json(
        { error: 'Invalid industry selected' },
        { status: 400 }
      )
    }

    // Check if admin email already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: adminEmail },
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

    // Create company and admin in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName,
          industryId,
          status: 'ONBOARDING',
        },
      })

      const admin = await tx.admin.create({
        data: {
          companyId: company.id,
          email: adminEmail,
          name: adminName,
          isFullAccess: true,
          status: 'PENDING',
          inviteToken,
          inviteExpiry,
        },
      })

      return { company, admin }
    })

    // Send invite email
    try {
      await sendAdminInvite(
        adminEmail,
        adminName,
        companyName,
        inviteToken
      )
    } catch (emailError) {
      console.error('Failed to send invite email:', emailError)
      // Don't fail the request if email fails - admin can be re-invited
    }

    return NextResponse.json({
      success: true,
      company: {
        id: result.company.id,
        name: result.company.name,
      },
      admin: {
        id: result.admin.id,
        email: result.admin.email,
      },
    })
  } catch (error) {
    console.error('Error creating company:', error)
    return NextResponse.json(
      { error: 'Failed to create company' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'sysadmin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const companies = await prisma.company.findMany({
      include: {
        _count: {
          select: {
            shops: true,
            admins: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(companies)
  } catch (error) {
    console.error('Error fetching companies:', error)
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500 }
    )
  }
}
