import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admins - List all admins for the company (Full Access only)
export async function GET() {
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

    if (!admin.isFullAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const admins = await prisma.admin.findMany({
      where: { companyId: admin.companyId },
      include: {
        shopAssignments: {
          include: { shop: { select: { id: true, name: true } } },
        },
        _count: { select: { shopAssignments: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(admins)
  } catch (error) {
    console.error('Error fetching admins:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admins' },
      { status: 500 }
    )
  }
}
